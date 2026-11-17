# 🌿 Prokitir Bazar (প্রকৃতির বাজার) — Organic E-Commerce Platform

![Prokitir Bazar Banner](https://i.ibb.co.com/GvHg2Qj9/Screenshot-932.png)

## 📖 Project Overview
**Prokitir Bazar** is a full-stack MERN e-commerce web application designed to connect consumers directly with authentic, organic, and natural products. The platform offers a seamless shopping experience with dynamic product filtering, secure user authentication, cloud-based media management, and an integrated payment gateway for hassle-free online transactions.

🔗 **Live Demo:** [Visit Prokitir Bazar](https://prokritirbazar-client.vercel.app/)  
🔗 **Client Repository:** [GitHub Client Repo](https://github.com/nasrinnahardisha/prokritirbazar-client)  
🔗 **Server Repository:** [GitHub Server Repo](https://github.com/nasrinnahardisha/prokritirbazar-server)

---

## 🛠️ Main Technologies Used

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React.js, Tailwind CSS, DaisyUI, React Router |
| **Backend** | Node.js, Express.js |
| **Database** | MongoDB (Atlas) |
| **Authentication** | Firebase Authentication |
| **Media & Storage** | Cloudinary API |
| **Payment Gateway** | SSLCommerz |
| **Deployment** | Vercel (Frontend & Serverless Backend) |

### 💡 Why These Technologies Were Chosen
- **React.js & Tailwind CSS:** Chosen for building a fast, component-based, and mobile-first responsive UI with clean styling.
- **Node.js, Express.js & MongoDB:** Provides a flexible, scalable NoSQL schema ideal for handling diverse product attributes, categories, and order histories.
- **Firebase & Cloudinary:** Ensures reliable user authentication and optimized image delivery without overloading the primary server.
- **SSLCommerz:** Integrated to support local Bangladeshi payment methods (bKash, Nagad, Cards) securely.

---

## ✨ Key Features
- 🔐 **Secure Authentication:** Email/password and social login powered by Firebase Authentication with protected routes.
- 🛍️ **Dynamic Product Catalog:** Browse products by category, search items in real time, and view detailed product descriptions.
- 🛒 **Smart Shopping Cart:** Add/remove items, update quantities dynamically, and calculate total prices automatically.
- 💳 **Integrated Payment System:** End-to-end checkout flow with SSLCommerz payment gateway integration (Success, Fail, and Cancel handling).
- 🖼️ **Cloud Image Upload:** Admins can upload high-resolution product images directly via Cloudinary integration.
- 📱 **Fully Responsive Design:** Optimized for desktop, tablet, and mobile devices.

---

## 📦 Key Dependencies
- `react` & `react-dom` — Core UI library
- `react-router-dom` — Client-side routing and navigation
- `firebase` — User authentication and session management
- `axios` — HTTP requests and API communication
- `tailwindcss` & `daisyui` — Utility-first CSS framework and UI components
- `express`, `cors`, `dotenv`, `mongodb` — Backend server, middleware, and database driver

---

## 🧩 Challenges Faced & Solutions

1. **Payment Gateway Callback & CORS Handling on Vercel:**
   - *Challenge:* Handling POST redirects from SSLCommerz to the frontend after payment completion caused CORS and route-not-found issues in a serverless environment.
   - *Solution:* Configured explicit CORS policies on the Express server and created dedicated backend callback endpoints (`/payment/success`, `/payment/fail`) that validate transactions before redirecting users to the appropriate frontend routes.

2. **Image Optimization & Upload Latency:**
   - *Challenge:* Uploading large product images directly to the server slowed down API responses.
   - *Solution:* Offloaded media storage to **Cloudinary**, storing only lightweight secure URLs in MongoDB, which significantly improved page load times.

