# React Frontend for CarRentalSysV2

This folder contains a React + Vite web UI that reads data from the Java API server.

## 1. Start Java API

From project root:

```bash
mkdir -p build/classes
javac -d build/classes $(find src -name "*.java")
java -cp build/classes carrentalsystem.CarRentalApiServer
```

API runs on `http://localhost:8080`.

## 2. Start React app

In another terminal:

```bash
cd frontend-react
npm install
npm run dev
```

Frontend runs on `http://localhost:5173`.
