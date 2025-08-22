const Order = require("../../models/Order");
const Cart = require("../../models/Cart");
const Product = require("../../models/Product");

const Razorpay = require("razorpay");

// Initialize Razorpay instance with env keys
const razorpayInstance = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_SECRET,
});

// ----------------------------------------------
// Create Razorpay order (amount, currency)
// ----------------------------------------------
const createOrder = async (req, res) => {
  try {
    const { totalAmount, currency = "INR" } = req.body;

    const options = {
      amount: totalAmount * 100, // Convert to paisa
      currency,
      receipt: `order_rcptid_${Date.now()}`,
    };

    const razorpayOrder = await razorpayInstance.orders.create(options);

    return res.status(200).json({
      success: true,
      order: razorpayOrder,
    });
  } catch (err) {
    console.error("Create Razorpay order error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to create Razorpay order",
    });
  }
};

// ----------------------------------------------
// Capture payment & create Order in DB
// ----------------------------------------------
const capturePayment = async (req, res) => {
  try {
    const {
      userId,
      cartId,
      cartItems,
      addressInfo,
      totalAmount,
      paymentId,
      payerId,
      paymentStatus,
      orderStatus,
      paymentMethod,
      orderDate,
      orderUpdateDate,
    } = req.body;

    const newOrder = new Order({
      userId,
      cartId,
      cartItems,
      addressInfo,
      totalAmount,
      paymentId,
      payerId,
      paymentStatus,
      orderStatus,
      paymentMethod,
      orderDate,
      orderUpdateDate,
    });

    // Reduce stock for each product
    for (let item of cartItems) {
      const product = await Product.findById(item.productId);
      if (!product) {
        return res.status(404).json({
          success: false,
          message: `Product not found: ${item.title}`,
        });
      }
      product.totalStock -= item.quantity;
      await product.save();
    }

    // Remove cart after order is confirmed
    await Cart.findByIdAndDelete(cartId);

    await newOrder.save();

    res.status(200).json({
      success: true,
      message: "Order confirmed and saved.",
      data: newOrder,
    });
  } catch (err) {
    console.error("Capture payment error:", err);
    res.status(500).json({
      success: false,
      message: "Error capturing payment and saving order.",
    });
  }
};

// ----------------------------------------------
// Get all orders of a user
// ----------------------------------------------
const getAllOrdersByUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const orders = await Order.find({ userId }).sort({ createdAt: -1 });

    if (!orders.length) {
      return res.status(404).json({
        success: false,
        message: "No orders found!",
      });
    }

    res.status(200).json({
      success: true,
      data: orders,
    });
  } catch (err) {
    console.error("Get orders error:", err);
    res.status(500).json({
      success: false,
      message: "Some error occurred!",
    });
  }
};

// ----------------------------------------------
// Get single order details by order ID
// ----------------------------------------------
const getOrderDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const order = await Order.findById(id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found!",
      });
    }

    res.status(200).json({
      success: true,
      data: order,
    });
  } catch (err) {
    console.error("Get order details error:", err);
    res.status(500).json({
      success: false,
      message: "Some error occurred!",
    });
  }
};

module.exports = {
  createOrder,
  capturePayment,
  getAllOrdersByUser,
  getOrderDetails,
};