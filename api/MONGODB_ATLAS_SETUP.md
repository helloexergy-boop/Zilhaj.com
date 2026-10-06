# 🍃 MongoDB Atlas Cloud Setup Guide for Umrah Booking API

Follow these simple steps to set up your free cloud database on **MongoDB Atlas** and connect it to your Spring Boot backend.

---

## ⚡ Step 1: Create a Free MongoDB Atlas Account & Cluster

1. Go to [MongoDB Atlas Website](https://www.mongodb.com/cloud/atlas/register) and create a free account (or log in).
2. Click **Create a Database** and select the **M0 Free Tier**.
3. Choose your preferred Cloud Provider (AWS/GCP) and Region (e.g. Frankfurt, Mumbai, N. Virginia).
4. Click **Create Cluster**.

---

## 🔑 Step 2: Database User & Network Access Setup

1. **Security -> Database Access**:
   - Click **Add New Database User**.
   - Set **Authentication Method**: Password.
   - Enter a **Username** (e.g. `umrah_admin`) and **Password** (e.g. `SecurePassword123`).
   - Assign user privilege: **Read and write to any database**.
   - Click **Add User**.

2. **Security -> Network Access**:
   - Click **Add IP Address**.
   - Click **ALLOW ACCESS FROM ANYWHERE** (`0.0.0.0/0`) or enter your current IP.
   - Click **Confirm**.

---

## 🔗 Step 3: Copy Connection String & Connect Backend

1. Go to **Database Deployments**, click **Connect** next to your cluster.
2. Select **Drivers** (Java).
3. Copy your connection URI string. It will look like this:
   ```text
   mongodb+srv://umrah_admin:<password>@cluster0.abcde.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0
   ```

4. **Option A: Paste in `application.properties`**:
   Open `d:\GoExergy\api\src\main\resources\application.properties` and replace:
   ```properties
   spring.data.mongodb.uri=mongodb+srv://umrah_admin:YOUR_ACTUAL_PASSWORD@cluster0.abcde.mongodb.net/umrah_db?retryWrites=true&w=majority
   ```

5. **Option B: Pass via Environment Variable (Recommended for production)**:
   In your terminal before running Spring Boot:
   - **PowerShell**:
     ```powershell
     $env:SPRING_DATA_MONGODB_URI="mongodb+srv://umrah_admin:YOUR_ACTUAL_PASSWORD@cluster0.abcde.mongodb.net/umrah_db?retryWrites=true&w=majority"
     .\mvnw.cmd spring-boot:run
     ```
   - **CMD**:
     ```cmd
     set SPRING_DATA_MONGODB_URI=mongodb+srv://umrah_admin:YOUR_ACTUAL_PASSWORD@cluster0.abcde.mongodb.net/umrah_db?retryWrites=true&w=majority
     .\mvnw.cmd spring-boot:run
     ```

---

## ✅ Step 4: Verification

When you start the Spring Boot backend (`.\mvnw.cmd spring-boot:run`), you will see:
```text
INFO : Database is empty. Seeding initial accounts, agents, and Umrah packages...
INFO : Sample database seeding completed successfully!
```
Your MongoDB Atlas database will be automatically created with collections for `users`, `agents`, `packages`, `bookings`, `payments`, and `reviews`!
