import React, { useState, useRef, useEffect } from 'react';
import { Plus, Download, Search, Package, Truck, MapPin, Trash2, Edit, FileText, CheckSquare, Square } from 'lucide-react';
import { productAPI, gatePassAPI } from '../services/api';

const InventorySystem = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [productToDelete, setProductToDelete] = useState(null);
  const [showGatePassForm, setShowGatePassForm] = useState(false);
  const [selectedForTransport, setSelectedForTransport] = useState([]);
  const [generatedGatePass, setGeneratedGatePass] = useState(null);
  const [showQuantityModal, setShowQuantityModal] = useState(false);
  const [currentProductForQuantity, setCurrentProductForQuantity] = useState(null);
  const [requestedQuantity, setRequestedQuantity] = useState('');
  const [showGatePassHistory, setShowGatePassHistory] = useState(false);
  const [gatePassHistory, setGatePassHistory] = useState([]);
  const [gatePassDetails, setGatePassDetails] = useState({
    destination: '',
    preparedBy: '',
    checkedBy: '',
    authorizedBy: ''
  });
  const qrRef = useRef(null);

  const [newProduct, setNewProduct] = useState({
    name: '',
    transport: 'Road',
    description: '',
    quantity: '',
    from: '',
    to: 'Vemagiri GIS',
    type: 'Electronics',
    remarks: ''
  });

  // Load data on component mount
  useEffect(() => {
    loadProducts();
    loadGatePassHistory();
  }, []);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const response = await productAPI.getAll();
      setProducts(response.data);
    } catch (error) {
      console.error('Error loading products:', error);
      alert('Error loading products from database');
    } finally {
      setLoading(false);
    }
  };

  const loadGatePassHistory = async () => {
    try {
      const response = await gatePassAPI.getAll();
      setGatePassHistory(response.data);
    } catch (error) {
      console.error('Error loading gate pass history:', error);
    }
  };

  // Generate QR Code SVG
  const generateQRCode = (text) => {
    const size = 100;
    const modules = 21;
    const moduleSize = size / modules;
    
    const pattern = [];
    for (let i = 0; i < modules; i++) {
      pattern[i] = [];
      for (let j = 0; j < modules; j++) {
        const hash = (text.charCodeAt((i + j) % text.length) + i * j) % 2;
        pattern[i][j] = hash === 1;
      }
    }

    return (
      <svg width={size} height={size} className="border">
        {pattern.map((row, i) =>
          row.map((module, j) => (
            module && (
              <rect
                key={`${i}-${j}`}
                x={j * moduleSize}
                y={i * moduleSize}
                width={moduleSize}
                height={moduleSize}
                fill="black"
              />
            )
          ))
        )}
      </svg>
    );
  };

  // Generate Barcode SVG
  const generateBarcode = (text) => {
    const width = 150;
    const height = 40;
    const bars = [];
    
    for (let i = 0; i < text.length * 8; i++) {
      const charCode = text.charCodeAt(i % text.length);
      const barWidth = 2 + (charCode % 3);
      const shouldDraw = (charCode + i) % 3 !== 0;
      
      if (shouldDraw) {
        bars.push(
          <rect
            key={i}
            x={i * 3}
            y={0}
            width={barWidth}
            height={height}
            fill="black"
          />
        );
      }
    }

    return (
      <svg width={width} height={height} className="border bg-white">
        {bars}
        <text
          x={width / 2}
          y={height + 15}
          textAnchor="middle"
          fontSize="8"
          fill="black"
        >
          {text}
        </text>
      </svg>
    );
  };

  const handleAddProduct = async () => {
    if (!newProduct.name || !newProduct.quantity || !newProduct.from) {
      alert('Please fill in all required fields (Name, Quantity, From)');
      return;
    }
    
    try {
      await productAPI.create(newProduct);
      await loadProducts(); // Reload products from database
      setNewProduct({
        name: '',
        transport: 'Road',
        description: '',
        quantity: '',
        from: '',
        to: 'Vemagiri GIS',
        type: 'Electronics',
        remarks: ''
      });
      setShowAddForm(false);
      alert('Product added successfully!');
    } catch (error) {
      console.error('Error adding product:', error);
      alert('Error adding product to database');
    }
  };

  const handleDeleteProduct = async (productId) => {
    try {
      await productAPI.delete(productId);
      await loadProducts(); // Reload products
      setProductToDelete(null);
      alert('Product deleted successfully!');
    } catch (error) {
      console.error('Error deleting product:', error);
      alert('Error deleting product from database');
    }
  };

  const confirmDelete = (product) => {
    setProductToDelete(product);
  };

  const toggleProductSelection = (product) => {
    setCurrentProductForQuantity(product);
    setRequestedQuantity('');
    setShowQuantityModal(true);
  };

  const addToTransportList = () => {
    const quantity = parseInt(requestedQuantity);
    const product = currentProductForQuantity;
    
    if (!quantity || quantity <= 0) {
      alert('Please enter a valid quantity');
      return;
    }
    
    if (quantity > product.quantity) {
      alert(`Available quantity is only ${product.quantity}`);
      return;
    }

    const existingIndex = selectedForTransport.findIndex(item => item._id === product._id);
    
    if (existingIndex !== -1) {
      const updatedTransport = [...selectedForTransport];
      const newQuantity = updatedTransport[existingIndex].selectedQuantity + quantity;
      
      if (newQuantity > product.quantity) {
        alert(`Total selected quantity (${newQuantity}) exceeds available quantity (${product.quantity})`);
        return;
      }
      
      updatedTransport[existingIndex].selectedQuantity = newQuantity;
      setSelectedForTransport(updatedTransport);
    } else {
      const transportItem = {
        ...product,
        selectedQuantity: quantity
      };
      setSelectedForTransport([...selectedForTransport, transportItem]);
    }
    
    setShowQuantityModal(false);
    setCurrentProductForQuantity(null);
    setRequestedQuantity('');
  };

  const removeFromTransportList = (productId) => {
    setSelectedForTransport(prev => prev.filter(item => item._id !== productId));
  };

  const generateGatePass = async () => {
    if (selectedForTransport.length === 0) {
      alert('Please select at least one product for transport');
      return;
    }
    
    if (!gatePassDetails.destination || !gatePassDetails.preparedBy) {
      alert('Please fill in destination and prepared by fields');
      return;
    }

    try {
      const gatePassData = {
        date: new Date().toLocaleDateString('en-IN'),
        to: gatePassDetails.destination,
        products: selectedForTransport.map(item => ({
          productId: item.productId,
          name: item.name,
          transport: item.transport,
          description: item.description,
          selectedQuantity: item.selectedQuantity,
          type: item.type,
          remarks: item.remarks
        })),
        preparedBy: gatePassDetails.preparedBy,
        checkedBy: gatePassDetails.checkedBy,
        authorizedBy: gatePassDetails.authorizedBy
      };

      const response = await gatePassAPI.create(gatePassData);
      setGeneratedGatePass(response.data);
      
      // Reload products and history
      await loadProducts();
      await loadGatePassHistory();
      
      // Reset form
      setSelectedForTransport([]);
      setShowGatePassForm(false);
      setGatePassDetails({
        destination: '',
        preparedBy: '',
        checkedBy: '',
        authorizedBy: ''
      });

      alert('Gate pass generated successfully!');
    } catch (error) {
      console.error('Error generating gate pass:', error);
      alert('Error generating gate pass');
    }
  };

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.productId.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const transportModes = ['Road', 'Rail', 'Air', 'Sea', 'Multi-modal'];
  const productTypes = ['Electronics', 'Clothing', 'Food', 'Accessories', 'Healthcare', 'Industrial', 'Books', 'Furniture', 'Sports', 'Beauty'];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-lg text-gray-600">Loading PowerGrid Inventory...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header with Logo - NO BUTTONS */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6 text-center">
          <div className="flex flex-col items-center space-y-4">
            {/* PowerGrid Logo */}
            <div className="mb-2">
              <svg width="120" height="120" viewBox="0 0 120 120" className="drop-shadow-lg">
                <circle cx="60" cy="60" r="58" fill="#1e40af" stroke="#1d4ed8" strokeWidth="2"/>
                <g>
                  <rect x="12" y="20" width="36" height="3" fill="white" rx="1"/>
                  <rect x="14" y="26" width="34" height="3" fill="white" rx="1"/>
                  <rect x="16" y="32" width="32" height="3" fill="white" rx="1"/>
                  <rect x="18" y="38" width="30" height="3" fill="white" rx="1"/>
                  <rect x="20" y="44" width="28" height="3" fill="white" rx="1"/>
                  <rect x="22" y="50" width="26" height="3" fill="white" rx="1"/>
                  <rect x="24" y="56" width="24" height="3" fill="white" rx="1"/>
                  <rect x="26" y="62" width="22" height="3" fill="white" rx="1"/>
                  <rect x="24" y="68" width="24" height="3" fill="white" rx="1"/>
                  <rect x="22" y="74" width="26" height="3" fill="white" rx="1"/>
                  <rect x="20" y="80" width="28" height="3" fill="white" rx="1"/>
                  <rect x="18" y="86" width="30" height="3" fill="white" rx="1"/>
                  <rect x="16" y="92" width="32" height="3" fill="white" rx="1"/>
                  <rect x="14" y="98" width="34" height="3" fill="white" rx="1"/>
                </g>
                <g>
                  <rect x="72" y="20" width="36" height="3" fill="white" rx="1"/>
                  <rect x="72" y="26" width="34" height="3" fill="white" rx="1"/>
                  <rect x="72" y="32" width="32" height="3" fill="white" rx="1"/>
                  <rect x="72" y="38" width="30" height="3" fill="white" rx="1"/>
                  <rect x="72" y="44" width="28" height="3" fill="white" rx="1"/>
                  <rect x="72" y="50" width="26" height="3" fill="white" rx="1"/>
                  <rect x="72" y="56" width="24" height="3" fill="white" rx="1"/>
                  <rect x="72" y="62" width="22" height="3" fill="white" rx="1"/>
                  <rect x="72" y="68" width="24" height="3" fill="white" rx="1"/>
                  <rect x="72" y="74" width="26" height="3" fill="white" rx="1"/>
                  <rect x="72" y="80" width="28" height="3" fill="white" rx="1"/>
                  <rect x="72" y="86" width="30" height="3" fill="white" rx="1"/>
                  <rect x="72" y="92" width="32" height="3" fill="white" rx="1"/>
                  <rect x="72" y="98" width="34" height="3" fill="white" rx="1"/>
                </g>
                <path d="M52 15 L68 15 L62 50 L70 50 L48 105 L54 70 L46 70 Z" fill="#dc2626"/>
                <text x="60" y="112" textAnchor="middle" fontSize="12" fill="#1e40af" fontWeight="bold" fontFamily="Arial">पावरग्रिड</text>
              </svg>
            </div>
            
            <div>
              <h1 className="text-3xl font-bold text-gray-900">PowerGrid Vemagiri Substation Inventory</h1>
              <p className="text-lg text-gray-600 mt-2">Power Grid Corporation of India Limited</p>
            </div>
          </div>
          
          {/* Search */}
          <div className="relative mt-6">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <input
              type="text"
              placeholder="Search products by name, ID, or type..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Products Table */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden mb-6">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Select</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">S.No</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product ID</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product Name</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Transport</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">From</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">To</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Remarks</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Codes</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredProducts.map((product, index) => (
                  <tr key={product._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => toggleProductSelection(product)}
                        className="text-blue-600 hover:text-blue-800 p-1 rounded-md hover:bg-blue-50 transition-colors"
                        title="Add to Gate Pass"
                      >
                        <Plus className="h-5 w-5" />
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{index + 1}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-blue-600">{product.productId}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{product.name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Truck className="h-4 w-4 text-gray-400 mr-2" />
                        <span className="text-sm text-gray-900">{product.transport}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 max-w-xs truncate" title={product.description}>
                        {product.description}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        {product.quantity}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <MapPin className="h-4 w-4 text-gray-400 mr-1" />
                        <span className="text-sm text-gray-900">{product.from}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <MapPin className="h-4 w-4 text-gray-400 mr-1" />
                        <span className="text-sm text-gray-900">{product.to}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {product.type}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 max-w-xs truncate" title={product.remarks}>
                        {product.remarks}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => setSelectedProduct(product)}
                        className="text-blue-600 hover:text-blue-900 text-sm font-medium"
                      >
                        View Codes
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => confirmDelete(product)}
                          className="text-red-600 hover:text-red-900 p-1 rounded-md hover:bg-red-50 transition-colors"
                          title="Delete Product"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Action Buttons - ONLY LOCATION FOR BUTTONS */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex justify-center space-x-4">
            <button
              onClick={() => setShowAddForm(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg flex items-center space-x-2 transition-colors text-lg font-medium"
            >
              <Plus className="h-6 w-6" />
              <span>Add Product</span>
            </button>
            <button
              onClick={() => setShowGatePassForm(true)}
              className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg flex items-center space-x-2 transition-colors text-lg font-medium"
            >
              <FileText className="h-6 w-6" />
              <span>Generate Gate Pass</span>
            </button>
            <button
              onClick={() => setShowGatePassHistory(true)}
              className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg flex items-center space-x-2 transition-colors text-lg font-medium"
            >
              <FileText className="h-6 w-6" />
              <span>View Gate Pass History</span>
            </button>
          </div>
        </div>

        {/* Gate Pass History Modal */}
        {showGatePassHistory && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-gray-900">Gate Pass History</h2>
                  <button
                    onClick={() => setShowGatePassHistory(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <span className="text-2xl">&times;</span>
                  </button>
                </div>
                
                {gatePassHistory.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse border border-gray-300">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="border border-gray-300 px-4 py-3 text-left text-sm font-medium text-gray-500">Gate Pass No.</th>
                          <th className="border border-gray-300 px-4 py-3 text-left text-sm font-medium text-gray-500">Generated Date</th>
                          <th className="border border-gray-300 px-4 py-3 text-left text-sm font-medium text-gray-500">Destination</th>
                          <th className="border border-gray-300 px-4 py-3 text-left text-sm font-medium text-gray-500">Products Count</th>
                          <th className="border border-gray-300 px-4 py-3 text-left text-sm font-medium text-gray-500">Prepared By</th>
                          <th className="border border-gray-300 px-4 py-3 text-left text-sm font-medium text-gray-500">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {gatePassHistory.map((gatePass, index) => (
                          <tr key={gatePass._id} className="hover:bg-gray-50">
                            <td className="border border-gray-300 px-4 py-3 text-sm font-medium text-blue-600">
                              {gatePass.gatePassNumber}
                            </td>
                            <td className="border border-gray-300 px-4 py-3 text-sm text-gray-900">
                              {new Date(gatePass.generatedAt).toLocaleString('en-IN')}
                            </td>
                            <td className="border border-gray-300 px-4 py-3 text-sm text-gray-900">
                              {gatePass.to}
                            </td>
                            <td className="border border-gray-300 px-4 py-3 text-sm text-gray-900">
                              {gatePass.products.length} items
                            </td>
                            <td className="border border-gray-300 px-4 py-3 text-sm text-gray-900">
                              {gatePass.preparedBy}
                            </td>
                            <td className="border border-gray-300 px-4 py-3 text-sm">
                              <button
                                onClick={() => {
                                  setGeneratedGatePass(gatePass);
                                  setShowGatePassHistory(false);
                                }}
                                className="text-blue-600 hover:text-blue-900 font-medium"
                              >
                                View PDF
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Gate Passes Generated</h3>
                    <p className="text-gray-500">Generate your first gate pass to see the history here.</p>
                  </div>
                )}
                
                <div className="flex justify-end mt-6">
                  <button
                    onClick={() => setShowGatePassHistory(false)}
                    className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Quantity Selection Modal */}
        {showQuantityModal && currentProductForQuantity && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-md w-full">
              <div className="p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Select Quantity for Transport</h3>
                
                <div className="bg-gray-50 rounded-lg p-4 mb-4">
                  <h4 className="font-medium text-gray-900">{currentProductForQuantity.name}</h4>
                  <p className="text-sm text-gray-600">Product ID: {currentProductForQuantity.productId}</p>
                  <p className="text-sm text-gray-600">Available Quantity: {currentProductForQuantity.quantity}</p>
                  <p className="text-sm text-gray-600">Type: {currentProductForQuantity.type}</p>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Quantity to Transport *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={currentProductForQuantity.quantity}
                    placeholder={`Max: ${currentProductForQuantity.quantity}`}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={requestedQuantity}
                    onChange={(e) => setRequestedQuantity(e.target.value)}
                    autoFocus
                  />
                </div>

                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => {
                      setShowQuantityModal(false);
                      setCurrentProductForQuantity(null);
                      setRequestedQuantity('');
                    }}
                    className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={addToTransportList}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Add to Gate Pass
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Gate Pass Form Modal */}
        {showGatePassForm && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Generate Gate Pass</h2>
                
                <div className="mb-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-3">
                    Selected Products ({selectedForTransport.length})
                  </h3>
                  {selectedForTransport.length > 0 ? (
                    <div className="bg-gray-50 rounded-lg p-4 max-h-40 overflow-y-auto">
                      {selectedForTransport.map(item => (
                        <div key={item._id} className="flex justify-between items-center py-2 border-b border-gray-200 last:border-0">
                          <div>
                            <span className="font-medium">{item.name}</span>
                            <div className="text-xs text-gray-500">
                              ID: {item.productId} | Transport Qty: {item.selectedQuantity} | 
                              From: Vemagiri GIS → To: {gatePassDetails.destination || 'Destination TBD'}
                            </div>
                          </div>
                          <button
                            onClick={() => removeFromTransportList(item._id)}
                            className="text-red-600 hover:text-red-800 p-1 rounded-md hover:bg-red-50"
                            title="Remove from gate pass"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 italic">No products selected. Please select products from the inventory table above.</p>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Destination Substation *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g., HYDERABAD GIS, CHENNAI GIS"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      value={gatePassDetails.destination}
                      onChange={(e) => setGatePassDetails({...gatePassDetails, destination: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Prepared By *</label>
                    <input
                      type="text"
                      required
                      placeholder="Your name and designation"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      value={gatePassDetails.preparedBy}
                      onChange={(e) => setGatePassDetails({...gatePassDetails, preparedBy: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Checked By</label>
                    <input
                      type="text"
                      placeholder="Supervisor name"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      value={gatePassDetails.checkedBy}
                      onChange={(e) => setGatePassDetails({...gatePassDetails, checkedBy: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Authorized By</label>
                    <input
                      type="text"
                      placeholder="Manager/Officer name"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      value={gatePassDetails.authorizedBy}
                      onChange={(e) => setGatePassDetails({...gatePassDetails, authorizedBy: e.target.value})}
                    />
                  </div>
                </div>

                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => {
                      setShowGatePassForm(false);
                      setSelectedForTransport([]);
                    }}
                    className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={generateGatePass}
                    className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
                  >
                    <FileText className="h-4 w-4" />
                    <span>Generate Gate Pass</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {productToDelete && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-md w-full">
              <div className="p-6">
                <div className="flex items-center mb-4">
                  <div className="flex-shrink-0">
                    <Trash2 className="h-6 w-6 text-red-600" />
                  </div>
                  <div className="ml-3">
                    <h3 className="text-lg font-medium text-gray-900">Delete Product</h3>
                  </div>
                </div>
                <div className="mb-6">
                  <p className="text-sm text-gray-600">
                    Are you sure you want to delete <strong>"{productToDelete.name}"</strong>? 
                    This action cannot be undone.
                  </p>
                  <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500"><strong>Product ID:</strong> {productToDelete.productId}</p>
                    <p className="text-xs text-gray-500"><strong>Quantity:</strong> {productToDelete.quantity}</p>
                    <p className="text-xs text-gray-500"><strong>Type:</strong> {productToDelete.type}</p>
                  </div>
                </div>
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => setProductToDelete(null)}
                    className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleDeleteProduct(productToDelete._id)}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center space-x-2"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Generated Gate Pass Modal */}
        {generatedGatePass && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-8">
                <div className="text-center mb-6 border-b-2 border-gray-300 pb-4">
                  <h1 className="text-2xl font-bold text-gray-900 underline">Gate Pass</h1>
                  <h2 className="text-lg font-semibold text-gray-800 mt-2">POWER GRID CORPORATION OF INDIA Ltd</h2>
                  <p className="text-md text-gray-700">VEMAGIRI G.I.S.</p>
                  <div className="flex justify-between mt-4 text-sm">
                    <span><strong>Gate Pass No:</strong> {generatedGatePass.gatePassNumber}</span>
                    <span><strong>Date:</strong> {generatedGatePass.date}</span>
                  </div>
                </div>

                <div className="mb-6">
                  <table className="w-full border-collapse border border-gray-400">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="border border-gray-400 px-3 py-2 text-left text-sm font-medium">S.No</th>
                        <th className="border border-gray-400 px-3 py-2 text-left text-sm font-medium">Mode of Transport</th>
                        <th className="border border-gray-400 px-3 py-2 text-left text-sm font-medium">Item Description</th>
                        <th className="border border-gray-400 px-3 py-2 text-left text-sm font-medium">Qty</th>
                        <th className="border border-gray-400 px-3 py-2 text-left text-sm font-medium">From</th>
                        <th className="border border-gray-400 px-3 py-2 text-left text-sm font-medium">To</th>
                        <th className="border border-gray-400 px-3 py-2 text-left text-sm font-medium">Type</th>
                        <th className="border border-gray-400 px-3 py-2 text-left text-sm font-medium">Remarks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {generatedGatePass.products.map((product, index) => (
                        <tr key={index}>
                          <td className="border border-gray-400 px-3 py-2 text-sm">{index + 1}</td>
                          <td className="border border-gray-400 px-3 py-2 text-sm">{product.transport}</td>
                          <td className="border border-gray-400 px-3 py-2 text-sm">{product.description}</td>
                          <td className="border border-gray-400 px-3 py-2 text-sm">{product.selectedQuantity}</td>
                          <td className="border border-gray-400 px-3 py-2 text-sm">Vemagiri GIS</td>
                          <td className="border border-gray-400 px-3 py-2 text-sm">{generatedGatePass.to}</td>
                          <td className="border border-gray-400 px-3 py-2 text-sm">{product.type}</td>
                          <td className="border border-gray-400 px-3 py-2 text-sm">{product.remarks}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="grid grid-cols-3 gap-8 mt-8 pt-6 border-t border-gray-300">
                  <div className="text-center">
                    <div className="mb-12"></div>
                    <div className="border-t border-gray-400 pt-2">
                      <p className="text-sm font-medium">Prepared By</p>
                      <p className="text-xs text-gray-600 mt-1">{generatedGatePass.preparedBy}</p>
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="mb-12"></div>
                    <div className="border-t border-gray-400 pt-2">
                      <p className="text-sm font-medium">Checked By</p>
                      <p className="text-xs text-gray-600 mt-1">{generatedGatePass.checkedBy || '_______________'}</p>
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="mb-12"></div>
                    <div className="border-t border-gray-400 pt-2">
                      <p className="text-sm font-medium">Authorized By</p>
                      <p className="text-xs text-gray-600 mt-1">{generatedGatePass.authorizedBy || '_______________'}</p>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end space-x-3 mt-8 pt-4 border-t border-gray-200">
                  <button
                    onClick={() => window.print()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
                  >
                    <Download className="h-4 w-4" />
                    <span>Print</span>
                  </button>
                  <button
                    onClick={() => setGeneratedGatePass(null)}
                    className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Add Product Modal */}
        {showAddForm && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Add New Product</h2>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Product Name</label>
                      <input
                        type="text"
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        value={newProduct.name}
                        onChange={(e) => setNewProduct({...newProduct, name: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Mode of Transport</label>
                      <select
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        value={newProduct.transport}
                        onChange={(e) => setNewProduct({...newProduct, transport: e.target.value})}
                      >
                        {transportModes.map(mode => (
                          <option key={mode} value={mode}>{mode}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <textarea
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={newProduct.description}
                      onChange={(e) => setNewProduct({...newProduct, description: e.target.value})}
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                      <input
                        type="number"
                        required
                        min="1"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        value={newProduct.quantity}
                        onChange={(e) => setNewProduct({...newProduct, quantity: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">From (Source Substation)</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g., Mumbai GIS, Delhi GIS"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        value={newProduct.from}
                        onChange={(e) => setNewProduct({...newProduct, from: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">To (Destination)</label>
                      <input
                        type="text"
                        disabled
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600"
                        value="Vemagiri GIS"
                        title="All inventory items are received at Vemagiri GIS"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Product Type</label>
                    <select
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={newProduct.type}
                      onChange={(e) => setNewProduct({...newProduct, type: e.target.value})}
                    >
                      {productTypes.map(type => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Remarks</label>
                    <textarea
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={newProduct.remarks}
                      onChange={(e) => setNewProduct({...newProduct, remarks: e.target.value})}
                    />
                  </div>
                  
                  <div className="flex justify-end space-x-3 pt-4">
                    <button
                      type="button"
                      onClick={() => setShowAddForm(false)}
                      className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleAddProduct}
                      className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Add Product
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Barcode/QR Code Modal */}
        {selectedProduct && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-lg w-full">
              <div className="p-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Product Codes</h2>
                <div className="text-center space-y-6">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Product: {selectedProduct.name}</h3>
                    <p className="text-sm text-gray-600 mb-4">ID: {selectedProduct.productId}</p>
                  </div>
                  
                  <div className="space-y-6">
                    <div>
                      <h4 className="text-md font-medium text-gray-700 mb-3">QR Code</h4>
                      <div className="flex justify-center">
                        {generateQRCode(selectedProduct.productId)}
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="text-md font-medium text-gray-700 mb-3">Barcode</h4>
                      <div className="flex justify-center">
                        {generateBarcode(selectedProduct.productId)}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex justify-center space-x-3 pt-4">
                    <button
                      onClick={() => setSelectedProduct(null)}
                      className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Summary Stats */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <div className="text-2xl font-bold text-blue-600">{products.length}</div>
            <div className="text-sm text-gray-600">Total Products</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <div className="text-2xl font-bold text-green-600">
              {products.reduce((sum, p) => sum + p.quantity, 0)}
            </div>
            <div className="text-sm text-gray-600">Total Quantity</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <div className="text-2xl font-bold text-purple-600">
              {new Set(products.map(p => p.type)).size}
            </div>
            <div className="text-sm text-gray-600">Product Types</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <div className="text-2xl font-bold text-orange-600">
              {new Set(products.map(p => p.transport)).size}
            </div>
            <div className="text-sm text-gray-600">Transport Modes</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InventorySystem;