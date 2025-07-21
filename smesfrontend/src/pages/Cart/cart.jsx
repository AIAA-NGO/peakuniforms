import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { printReceipt } from '../../components/utils/printUtils';
import { FaMoneyBillWave, FaMobileAlt, FaSpinner, FaPlus } from 'react-icons/fa';
import { MdCheckCircle, MdError, MdPending, MdClose } from 'react-icons/md';
import { useCart } from '../../context/CartContext';
import axios from 'axios';

const Cart = ({ onCloseCart }) => {
  const { cart, removeFromCart, updateQuantity, clearCart, applyDiscount, removeDiscount } = useCart();
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [mpesaNumber, setMpesaNumber] = useState('');
  const [checkoutError, setCheckoutError] = useState(null);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [customerError, setCustomerError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mpesaStatus, setMpesaStatus] = useState(null);
  const [mpesaLoading, setMpesaLoading] = useState(false);
  const [checkoutRequestId, setCheckoutRequestId] = useState(null);
  const [merchantRequestId, setMerchantRequestId] = useState(null);
  const [mpesaReceiptNumber, setMpesaReceiptNumber] = useState(null);
  const [lastStatusCheck, setLastStatusCheck] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState(null);
  const [activeTimer, setActiveTimer] = useState(null);
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '' });
  const [isAddingCustomer, setIsAddingCustomer] = useState(false);
  const [discountCode, setDiscountCode] = useState('');

  useEffect(() => {
    return () => {
      if (activeTimer) clearInterval(activeTimer);
    };
  }, [activeTimer]);

  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        setLoading(true);
        setCustomerError(null);
        
        const response = await axios.get(`${process.env.REACT_APP_API_BASE_URL}/customers`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
          }
        });

        setCustomers(response.data?.data || response.data || []);
      } catch (error) {
        console.error("Failed to fetch customers:", error);
        setCustomerError('Failed to load customers. Please try again.');
        setCustomers([]);
      } finally {
        setLoading(false);
      }
    };
    
    fetchCustomers();
  }, []);

  const formatPhoneNumber = (phone) => {
    if (!phone) return null;
    const digits = phone.replace(/\D/g, '');
    if (digits.startsWith('0')) return `254${digits.substring(1)}`;
    if (digits.startsWith('7') && digits.length === 9) return `254${digits}`;
    if (digits.startsWith('254') && digits.length === 12) return digits;
    return null;
  };

  const checkPaymentStatus = async (checkoutId, merchantId) => {
    try {
      const response = await axios.get(
        `${process.env.REACT_APP_API_BASE_URL}/mpesa/payment-status?checkout_id=${checkoutId}&merchant_id=${merchantId}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }
      );
      return response.data;
    } catch (error) {
      console.error("Status check error:", error);
      return { status: 'PENDING', error: error.message };
    }
  };

  const verifyMpesaPayment = async (checkoutId, merchantId) => {
    if (!checkoutId || !merchantId) {
      throw new Error('Missing request IDs for payment verification');
    }

    let retries = 0;
    const maxRetries = 24;
    let statusData = await checkPaymentStatus(checkoutId, merchantId);
    setLastStatusCheck(new Date().toLocaleTimeString());
    
    while (retries < maxRetries && statusData.status.toUpperCase() === 'PENDING') {
      await new Promise(resolve => setTimeout(resolve, 5000));
      statusData = await checkPaymentStatus(checkoutId, merchantId);
      setLastStatusCheck(new Date().toLocaleTimeString());
      retries++;
    }

    switch (statusData.status.toUpperCase()) {
      case 'COMPLETED':
        setMpesaReceiptNumber(statusData.transaction?.mpesaReceiptNumber || 'N/A');
        setMpesaStatus('Payment confirmed successfully!');
        setPaymentStatus('completed');
        return true;
      case 'FAILED':
      case 'CANCELLED':
        setMpesaStatus(statusData.transaction?.stkResponseDescription || 'Payment failed. Please try again.');
        setPaymentStatus('failed');
        return false;
      default:
        setMpesaStatus('Payment verification timeout. Please check your M-Pesa messages.');
        setPaymentStatus('failed');
        return false;
    }
  };

  const initiateMpesaPayment = async () => {
    try {
      setMpesaLoading(true);
      setPaymentStatus('pending');
      setMpesaStatus('Initiating M-Pesa payment...');
      
      const formattedPhone = formatPhoneNumber(mpesaNumber);
      if (!formattedPhone) {
        throw new Error('Invalid phone number format. Use 07XXXXXXXX or 2547XXXXXXXX');
      }

      const amount = Math.round(cart.total || 0);
      if (amount <= 0) {
        throw new Error('Invalid payment amount');
      }

      const response = await axios.post(
        `${process.env.REACT_APP_API_BASE_URL}/mpesa/stkpush/initiate`,
        {
          amount,
          phoneNumber: formattedPhone,
          accountReference: `INV-${Date.now()}`,
          transactionDesc: `Payment for ${selectedCustomer?.name || 'guest'}`
        },
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.data?.CheckoutRequestID || !response.data?.MerchantRequestID) {
        throw new Error('Invalid M-Pesa response: Missing required fields');
      }

      setCheckoutRequestId(response.data.CheckoutRequestID);
      setMerchantRequestId(response.data.MerchantRequestID);
      setMpesaStatus('Payment initiated. Please check your phone to complete payment...');
      
      return await verifyMpesaPayment(
        response.data.CheckoutRequestID,
        response.data.MerchantRequestID
      );
    } catch (error) {
      console.error("M-Pesa payment error:", error);
      setMpesaStatus(`Payment failed: ${error.response?.data?.message || error.message}`);
      setPaymentStatus('failed');
      throw error;
    } finally {
      setMpesaLoading(false);
    }
  };

  const resetPaymentState = () => {
    setMpesaStatus(null);
    setMpesaNumber('');
    setPaymentMethod('CASH');
    setMpesaReceiptNumber(null);
    setCheckoutRequestId(null);
    setMerchantRequestId(null);
    setPaymentStatus(null);
    if (activeTimer) {
      clearInterval(activeTimer);
      setActiveTimer(null);
    }
  };

  const handleAddCustomer = async () => {
    if (!newCustomer.name) {
      alert('Customer name is required');
      return;
    }

    try {
      setIsAddingCustomer(true);
      const response = await axios.post(
        `${process.env.REACT_APP_API_BASE_URL}/customers`,
        newCustomer,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
          }
        }
      );

      setCustomers([...customers, response.data]);
      setSelectedCustomer(response.data.id);
      setShowAddCustomerModal(false);
      setNewCustomer({ name: '', phone: '' });
    } catch (error) {
      console.error("Failed to add customer:", error);
      setCustomerError(error.response?.data?.message || 'Failed to add customer. Please try again.');
    } finally {
      setIsAddingCustomer(false);
    }
  };

  const handleApplyDiscount = async () => {
    try {
      const response = await axios.get(
        `${process.env.REACT_APP_API_BASE_URL}/discounts/code/${discountCode}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }
      );
      
      applyDiscount(response.data);
    } catch (error) {
      alert(error.response?.data?.message || 'Invalid discount code or expired discount');
    }
  };

  const handleCheckout = async () => {
    if (cart.items.length === 0) {
      alert('Cart is empty');
      return;
    }

    if (paymentMethod === 'MPESA' && !mpesaNumber) {
      alert('Please enter M-Pesa phone number');
      return;
    }

    try {
      setIsCheckingOut(true);
      setCheckoutError(null);
      
      let paymentSuccess = true;
      if (paymentMethod === 'MPESA') {
        paymentSuccess = await initiateMpesaPayment();
      }

      if (!paymentSuccess && paymentMethod === 'MPESA') {
        throw new Error('M-Pesa payment was not completed successfully');
      }

      const checkoutData = {
        customerId: selectedCustomer || null,
        paymentMethod: paymentMethod,
        mpesaNumber: paymentMethod === 'MPESA' ? formatPhoneNumber(mpesaNumber) : null,
        mpesaTransactionId: paymentMethod === 'MPESA' ? checkoutRequestId : null,
        mpesaReceiptNumber: paymentMethod === 'MPESA' ? mpesaReceiptNumber : null,
        items: cart.items.map(item => ({
          productId: item.id,
          quantity: item.quantity,
          price: item.price,
          name: item.name,
          sku: item.sku,
          discountAmount: item.discountAmount || 0
        })),
        subtotal: cart.subtotal,
        discountAmount: cart.discount,
        taxAmount: cart.tax,
        total: cart.total,
        appliedDiscountCode: cart.appliedDiscountCode
      };

      const response = await axios.post(
        `${process.env.REACT_APP_API_BASE_URL}/sales`,
        checkoutData,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const sale = response.data;
      
      try {
        if (sale?.id) {
          await printReceipt({
            ...sale,
            subtotal: cart.subtotal,
            discountAmount: cart.discount,
            taxAmount: cart.tax,
            total: cart.total
          });
        }
      } catch (printError) {
        console.error("Failed to print receipt:", printError);
      }
      
      clearCart();
      resetPaymentState();
      
      alert(
        `Order #${sale?.id || 'N/A'} completed successfully!\n\n` +
        `Payment Method: ${paymentMethod}\n` +
        `${paymentMethod === 'MPESA' ? 'M-Pesa Receipt: ' + (mpesaReceiptNumber || checkoutRequestId || 'N/A') : ''}\n` +
        `Total Amount: Ksh ${(cart.total || 0).toFixed(2)}`
      );
    } catch (err) {
      console.error("Checkout failed:", err);
      setCheckoutError(err.response?.data?.message || err.message || 'Checkout failed. Please try again.');
    } finally {
      setIsCheckingOut(false);
    }
  };

  const renderStatusIcon = () => {
    switch (paymentStatus) {
      case 'completed': return <MdCheckCircle className="text-green-500 text-xl mr-2" />;
      case 'failed': return <MdError className="text-red-500 text-xl mr-2" />;
      case 'pending': return <MdPending className="text-yellow-500 text-xl mr-2" />;
      default: return null;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-4 h-full flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-bold">Cart Details</h2>
        <button onClick={onCloseCart} className="lg:hidden text-gray-500 hover:text-gray-700">
          ×
        </button>
      </div>
      
      {cart.items.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-grow">
          <h3 className="text-lg font-medium mb-2">Your cart is empty</h3>
          <Link to="/pos" className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
            Continue Shopping
          </Link>
        </div>
      ) : (
        <div className="flex flex-col flex-grow">
          {/* Discount Application Section */}
          <div className="bg-gray-50 rounded-lg p-3 mb-3">
            <h3 className="font-bold mb-2">Apply Discount</h3>
            <div className="flex">
              <input
                type="text"
                placeholder="Enter discount code"
                value={discountCode}
                onChange={(e) => setDiscountCode(e.target.value)}
                className="flex-grow p-2 border border-gray-300 rounded-l-md"
              />
              <button
                onClick={handleApplyDiscount}
                className="bg-blue-500 text-white px-4 py-2 rounded-r-md hover:bg-blue-600"
              >
                Apply
              </button>
            </div>
            {cart.appliedDiscountCode && (
              <div className="mt-2 text-green-600">
                Discount applied: {cart.appliedDiscountCode}
                <button 
                  onClick={removeDiscount}
                  className="ml-2 text-red-500 hover:text-red-700"
                >
                  Remove
                </button>
              </div>
            )}
          </div>

          {/* Customer Information Section */}
          <div className="bg-gray-50 rounded-lg p-3 mb-3">
            <h3 className="font-bold mb-2">Customer Information</h3>
            {customerError && <div className="text-red-500 text-sm mb-2">{customerError}</div>}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div>
                <label className="block text-sm text-gray-700 mb-1">Select Customer</label>
                <div className="flex">
                  <select
                    value={selectedCustomer || ''}
                    onChange={(e) => setSelectedCustomer(e.target.value ? Number(e.target.value) : null)}
                    className="w-full p-2 border border-gray-300 rounded-l-md"
                  >
                    <option value="">Guest Customer</option>
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.name} ({customer.phone || 'No phone'})
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => setShowAddCustomerModal(true)}
                    className="bg-blue-500 text-white px-3 rounded-r-md hover:bg-blue-600 flex items-center"
                  >
                    <FaPlus />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Cart Items List */}
          <div className="flex-grow overflow-y-auto mb-3">
            <div className="divide-y divide-gray-200">
              {cart.items.map((item) => (
                <div key={item.id} className="py-3">
                  <div className="flex justify-between">
                    <h4 className="font-medium">{item.name || 'Product'}</h4>
                    <p className="text-sm">Unit Price: Ksh {item.price?.toFixed(2) || '0.00'}</p>
                  </div>
                  {item.discountAmount > 0 && (
                    <div className="text-sm text-green-600">
                      Discount: Ksh {item.discountAmount.toFixed(2)} ({(item.discountAmount / item.price * 100).toFixed(0)}%)
                    </div>
                  )}
                  <div className="flex justify-between items-center mt-1">
                    <div className="flex items-center">
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        className="px-2 py-1 border rounded-l-md bg-gray-100 hover:bg-gray-200"
                      >
                        -
                      </button>
                      <span className="px-2 py-1 border-t border-b text-sm">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        className="px-2 py-1 border rounded-r-md bg-gray-100 hover:bg-gray-200"
                      >
                        +
                      </button>
                    </div>
                    <p className="font-bold text-sm">
                      Ksh {((item.price - (item.discountAmount || 0)) * item.quantity).toFixed(2)}
                    </p>
                    <button
                      onClick={() => removeFromCart(item.id)}
                      className="text-red-500 hover:text-red-700 text-xs"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Payment Method Section */}
          <div className="bg-gray-50 rounded-lg p-3 mb-3">
            <h3 className="font-bold mb-2">Payment Method</h3>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <button
                onClick={() => setPaymentMethod('CASH')}
                className={`flex items-center justify-center p-2 rounded-md border ${paymentMethod === 'CASH' ? 'bg-blue-100 border-blue-500' : 'bg-white border-gray-300'}`}
              >
                <FaMoneyBillWave className="mr-2" />
                <span>Cash</span>
              </button>
              <button
                onClick={() => setPaymentMethod('MPESA')}
                className={`flex items-center justify-center p-2 rounded-md border ${paymentMethod === 'MPESA' ? 'bg-blue-100 border-blue-500' : 'bg-white border-gray-300'}`}
              >
                <FaMobileAlt className="mr-2" />
                <span>M-Pesa</span>
              </button>
            </div>

            {paymentMethod === 'MPESA' && (
              <div className="mt-2">
                <label className="block text-sm text-gray-700 mb-1">M-Pesa Phone Number</label>
                <input
                  type="text"
                  placeholder="e.g. 07XXXXXXXX"
                  value={mpesaNumber}
                  onChange={(e) => setMpesaNumber(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md"
                />
              </div>
            )}

            {mpesaStatus && (
              <div className={`mt-2 p-2 rounded-md text-sm flex items-center ${
                paymentStatus === 'completed' ? 'bg-green-100 text-green-800' :
                paymentStatus === 'failed' ? 'bg-red-100 text-red-800' :
                'bg-yellow-100 text-yellow-800'
              }`}>
                {renderStatusIcon()}
                <div>
                  <p>{mpesaStatus}</p>
                  {lastStatusCheck && <p className="text-xs mt-1">Last checked: {lastStatusCheck}</p>}
                  {mpesaReceiptNumber && <p className="text-xs mt-1">Receipt: {mpesaReceiptNumber}</p>}
                </div>
              </div>
            )}
          </div>

          {/* Cart Summary */}
          <div className="bg-gray-50 rounded-lg p-3 mb-3">
            <h3 className="font-bold mb-2">Cart Summary</h3>
            <div className="flex justify-between mb-1">
              <span>Subtotal (tax exclusive):</span>
              <span>Ksh {cart.subtotal?.toFixed(2) || '0.00'}</span>
            </div>
            <div className="flex justify-between mb-1">
              <span>Discount:</span>
              <span>Ksh {cart.discount?.toFixed(2) || '0.00'}</span>
            </div>
            <div className="flex justify-between mb-1">
              <span>Tax (16%):</span>
              <span>Ksh {cart.tax?.toFixed(2) || '0.00'}</span>
            </div>
            <div className="flex justify-between font-bold text-lg mt-2 pt-2 border-t border-gray-200">
              <span>Total:</span>
              <span>Ksh {cart.total?.toFixed(2) || '0.00'}</span>
            </div>
          </div>

          {/* Checkout Button */}
          <button
            onClick={handleCheckout}
            disabled={isCheckingOut || mpesaLoading}
            className={`w-full py-3 px-4 rounded-md text-white font-bold ${
              isCheckingOut || mpesaLoading ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {isCheckingOut || mpesaLoading ? (
              <div className="flex items-center justify-center">
                <FaSpinner className="animate-spin mr-2" />
                Processing...
              </div>
            ) : (
              `Complete Sales (Ksh ${cart.total?.toFixed(2) || '0.00'})`
            )}
          </button>

          {checkoutError && (
            <div className="mt-3 p-2 bg-red-100 text-red-800 rounded-md text-sm">
              {checkoutError}
            </div>
          )}
        </div>
      )}

      {/* Add Customer Modal */}
      {showAddCustomerModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">Add New Customer</h3>
              <button 
                onClick={() => setShowAddCustomerModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <MdClose size={24} />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-700 mb-1">Name *</label>
                <input
                  type="text"
                  value={newCustomer.name}
                  onChange={(e) => setNewCustomer({...newCustomer, name: e.target.value})}
                  className="w-full p-2 border border-gray-300 rounded-md"
                  placeholder="Customer name"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm text-gray-700 mb-1">Phone</label>
                <input
                  type="text"
                  value={newCustomer.phone}
                  onChange={(e) => setNewCustomer({...newCustomer, phone: e.target.value})}
                  className="w-full p-2 border border-gray-300 rounded-md"
                  placeholder="07XXXXXXXX"
                />
              </div>
              
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  onClick={() => setShowAddCustomerModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddCustomer}
                  disabled={isAddingCustomer || !newCustomer.name}
                  className={`px-4 py-2 rounded-md text-white ${
                    isAddingCustomer || !newCustomer.name ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  {isAddingCustomer ? (
                    <span className="flex items-center">
                      <FaSpinner className="animate-spin mr-2" />
                      Adding...
                    </span>
                  ) : 'Add Customer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Cart;