import { useState } from "react";

export default function Cart({ cart, setCart }) {

  const removeItem = (index) => {
    const updated = [...cart];

    const payNow = async () => {
  const res = await fetch("http://localhost:5000/api/payment/razorpay", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ amount: total })
  });

  const data = await res.json();

  const options = {
    key: "YOUR_RAZORPAY_KEY",
    amount: data.amount,
    currency: "INR",
    name: "Fashin",
    order_id: data.id,
    handler: () => {
      alert("Payment successful");
      setCart([]);
    }
  };

  const rzp = new window.Razorpay(options);
  rzp.open();
};
    updated.splice(index, 1);
    setCart(updated);
  };

  const total = cart.reduce((sum, item) => sum + item.price, 0);

  return (
    <div style={{ padding: 20 }}>
      <h2>Cart</h2>

      {cart.length === 0 && <p>Cart is empty</p>}

      {cart.map((item, i) => (
        <div key={i} style={{ marginBottom: 10 }}>
          {item.name} - ₹{item.price}
          <button onClick={() => removeItem(i)}>Remove</button>
        </div>
      ))}

      <h3>Total: ₹{total}</h3>
      <button onClick={payNow}>Checkout</button>
    </div>
  );
}