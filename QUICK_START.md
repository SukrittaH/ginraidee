# Quick Start - Ginraidee Full Stack Testing

## 🚀 Start Backend (Terminal 1)

```bash
cd /Users/atxm/Desktop/sandbox/ginraidee/backend
npm run dev
```

Wait for:
```
🚀 Server running on port 3000
✅ PostgreSQL connected successfully
📊 Database tables synchronized
```

## 📱 Start Mobile App (Terminal 2)

```bash
cd /Users/atxm/Desktop/sandbox/ginraidee
npm start
# or
expo start
```

## ✅ Test API (Optional - Terminal 3)

```bash
cd /Users/atxm/Desktop/sandbox/ginraidee/backend
node test-api.js
```

## 🔍 Quick Test Checklist

- [ ] Backend server running on port 3000
- [ ] Mobile app loads without errors
- [ ] Can register a new user
- [ ] Can add inventory item
- [ ] Item appears in list
- [ ] Can update item quantity
- [ ] Can delete item
- [ ] Restart app - item still there (database persistence)

## 📊 Backend Logs to Watch

When you interact with the mobile app, you should see SQL queries in the backend terminal:

```
User registration:
Executing (default): INSERT INTO "Users" ...
POST /api/auth/register HTTP/1.1 201

Add inventory:
Executing (default): INSERT INTO "InventoryItems" ...
POST /api/inventory HTTP/1.1 201

Get inventory:
Executing (default): SELECT * FROM "InventoryItems" ...
GET /api/inventory HTTP/1.1 200

Update item:
Executing (default): UPDATE "InventoryItems" ...
PUT /api/inventory/:id HTTP/1.1 200

Delete item:
Executing (default): DELETE FROM "InventoryItems" ...
DELETE /api/inventory/:id HTTP/1.1 200
```

## 🐛 Troubleshooting

| Problem | Solution |
|---------|----------|
| Port 3000 in use | `lsof -ti:3000 \| xargs kill -9` |
| Can't connect to backend | Check IP if on physical device, update `apiService.js` |
| Database connection failed | Check `.env` credentials and firewall rules |
| Items not persisting | Check PostgreSQL connection logs |

## 📁 New Files Created

- `/src/services/apiService.js` - HTTP API client
- `/src/context/AuthContext.js` - Authentication context
- Updated `/src/context/InventoryContext.js` - Now uses backend

## 🎯 What's Happening

```
Mobile App → APIService → Backend → PostgreSQL
```

All data is now saved to the database, not just in app memory!

## 📖 Full Documentation

See `FULL_LOOP_TESTING.md` for detailed testing guide.
