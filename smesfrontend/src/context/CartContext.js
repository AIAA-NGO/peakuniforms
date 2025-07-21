import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';

const CartContext = createContext();

export const CartProvider = ({ children }) => {
  const { user } = useAuth();
  
  const getCartFromStorage = () => {
    if (!user) return getEmptyCart();
    
    const userCartKey = `cart_${user.id}`;
    const cartData = sessionStorage.getItem(userCartKey);
    return cartData ? JSON.parse(cartData) : getEmptyCart();
  };

  const getEmptyCart = () => ({
    items: [],
    subtotal: 0,
    discount: 0,
    tax: 0,
    total: 0,
    appliedDiscountCode: null
  });

  const saveCartToStorage = (cart) => {
    if (user) {
      const userCartKey = `cart_${user.id}`;
      sessionStorage.setItem(userCartKey, JSON.stringify(cart));
    }
  };

  const calculateCartTotals = (items, appliedDiscount = null) => {
    // Calculate tax-inclusive subtotal (sum of all item prices)
    const taxInclusiveSubtotal = items.reduce((sum, item) => 
      sum + (item.price * item.quantity), 0);

    // Calculate total tax (16% of each item's price)
    const tax = items.reduce((sum, item) => 
      sum + (item.price * 0.16 * item.quantity), 0);

    // Calculate tax-exclusive subtotal (price without tax)
    const taxExclusiveSubtotal = taxInclusiveSubtotal - tax;

    // Calculate product-level discounts
    const productDiscounts = items.reduce((sum, item) => 
      sum + ((item.discountAmount || 0) * item.quantity), 0);

    // Apply cart-level discount if exists
    let cartDiscount = 0;
    if (appliedDiscount) {
      cartDiscount = taxExclusiveSubtotal * (appliedDiscount.percentage / 100);
    }

    const totalDiscount = productDiscounts + cartDiscount;
    const taxableAmount = taxExclusiveSubtotal - totalDiscount;

    return {
      preTaxAmount: parseFloat(taxableAmount.toFixed(2)),
      subtotal: parseFloat(taxInclusiveSubtotal.toFixed(2)),
      discount: parseFloat(totalDiscount.toFixed(2)),
      tax: parseFloat(tax.toFixed(2)),
      total: parseFloat((taxableAmount + tax).toFixed(2)),
      appliedDiscountCode: appliedDiscount?.code || null
    };
  };

  const [cart, setCart] = useState(getEmptyCart());

  // Update cart when user changes
  useEffect(() => {
    setCart(getCartFromStorage());
  }, [user]);

  const updateCart = (newCart) => {
    const cartWithTotals = {
      ...newCart,
      ...calculateCartTotals(newCart.items, newCart.appliedDiscount)
    };
    setCart(cartWithTotals);
    saveCartToStorage(cartWithTotals);
  };

  const addToCart = (product, quantity = 1) => {
    const productStock = product.quantity_in_stock || 0;
    const existingItem = cart.items.find(item => item.id === product.id);

    if (productStock < 1) return;

    const discountAmount = product.discountAmount || 0;

    let updatedItems;
    if (existingItem) {
      if (existingItem.quantity + quantity > productStock) {
        return;
      }
      updatedItems = cart.items.map(item => 
        item.id === product.id 
          ? { 
              ...item, 
              quantity: item.quantity + quantity,
              discountAmount
            }
          : item
      );
    } else {
      updatedItems = [
        ...cart.items,
        {
          id: product.id,
          name: product.name,
          price: product.price,
          quantity: quantity,
          discountAmount,
          imageUrl: product.hasImage ? `/api/products/${product.id}/image` : null,
          stock: product.quantity_in_stock,
          sku: product.sku || '',
          barcode: product.barcode || ''
        }
      ];
    }

    updateCart({
      ...cart,
      items: updatedItems
    });
  };

  const applyDiscount = (discount) => {
    updateCart({
      ...cart,
      appliedDiscount: {
        code: discount.code,
        percentage: discount.percentage
      }
    });
  };

  const removeDiscount = () => {
    updateCart({
      ...cart,
      appliedDiscount: null
    });
  };

  const removeFromCart = (id) => {
    const updatedItems = cart.items.filter(item => item.id !== id);
    updateCart({
      ...cart,
      items: updatedItems
    });
  };

  const updateQuantity = (id, newQuantity) => {
    if (newQuantity < 1) {
      removeFromCart(id);
      return;
    }
    
    const updatedItems = cart.items.map(item => {
      if (item.id === id) {
        return { ...item, quantity: newQuantity };
      }
      return item;
    });
    
    updateCart({
      ...cart,
      items: updatedItems
    });
  };

  const clearCart = () => {
    const emptyCart = getEmptyCart();
    setCart(emptyCart);
    saveCartToStorage(emptyCart);
  };

  return (
    <CartContext.Provider value={{ 
      cart, 
      addToCart, 
      removeFromCart, 
      updateQuantity, 
      clearCart,
      applyDiscount,
      removeDiscount
    }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  return useContext(CartContext);
};