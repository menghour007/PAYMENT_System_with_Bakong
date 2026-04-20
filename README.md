# 🚀 Bakong KHQR Payment System

A full-stack payment system using **Bakong KHQR**, built with:

- ⚛️ React (Vite)
- 🟢 Node.js + Express
- 🇰🇭 KHQR (Bakong API)
- 📲 Telegram notifications

---

## 📸 Features

- Generate KHQR for payments
- Open Bakong app via deeplink
- Real-time payment status checking
- Telegram order notification
- Map-based address selection
- Simple e-commerce UI

---

## 🛠️ Setup & Run Locally

### 1. Clone repo
```bash
git clone https://github.com/menghour007/PAYMENT_System_with_Bakong.git
cd PAYMENT_System_with_Bakong

### 2. Install dependencies
npm install

### 3. Create .env file
BAKONG_TOKEN=your_bakong_token
BAKONG_BASE_URL=https://api-bakong.nbc.gov.kh
BAKONG_MERCHANT_ID=your_merchant_id

TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id

###4 4. Run the app
npm run dev 
http://localhost:3000