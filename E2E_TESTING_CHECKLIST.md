# Nomad Map E2E Testing Checklist

## Server Status
✅ **Server starts successfully** on `http://localhost:7860`

## E2E Test Scenarios

### 1. UI Loading
- [ ] Navigate to `http://localhost:7860` in browser
- [ ] Verify Gradio UI loads completely
- [ ] Header with globe icon visible at top

### 2. Globe Map Modal Opening
- [ ] Click on globe icon in header
- [ ] Map modal opens with fade-in animation
- [ ] Modal shows title "🗺️ 나의 노마드 방명록"
- [ ] Map with OpenStreetMap tiles loads

### 3. City Search Functionality
- [ ] Type "서울" in search box
- [ ] Local fuzzy search results appear instantly
- [ ] Type "Kuala Lumpur" → Nominatim API results appear after 400ms
- [ ] Arrow keys navigate autocomplete results
- [ ] Press Enter to select city

### 4. City Selection & Pin Popup
- [ ] Click on a city in autocomplete
- [ ] Map flies to selected city with smooth animation
- [ ] Pin popup modal appears with city name
- [ ] "한줄평" input field focused

### 5. Location Permission
- [ ] Browser asks for location permission
- [ ] If allowed: distance to selected city shows in green
- [ ] If denied: "위치 권한 필요" shows in orange

### 6. Google OAuth Flow
- [ ] Click Google login button
- [ ] Redirect to Google OAuth page
- [ ] Complete authentication
- [ ] Callback to `http://localhost:7860/auth/google/callback`
- [ ] Auto-redirect to home page
- [ ] User name appears in modal header

### 7. Pin Saving
- [ ] Enter "한줄평" (note)
- [ ] Click "핀 저장하기" button
- [ ] Toast notification shows "📍 서울 핀이 저장됐어요!"
- [ ] Orange pin appears on map
- [ ] Stats bar shows "나의 핀 1"
- [ ] If multiple pins: orange line connects them chronologically

### 8. Community Pins
- [ ] Community pins (blue dots) visible on map
- [ ] Click blue community pin → popup shows "노마드 N명"
- [ ] Stats bar shows community pin count

### 9. Data Persistence
- [ ] Close modal and reopen
- [ ] My pins still visible
- [ ] GET `/api/pins` returns saved pins
- [ ] GET `/api/pins/community` returns aggregated data

### 10. Logout
- [ ] Click logout link in modal
- [ ] User bar disappears
- [ ] Login CTA banner reappears
- [ ] My pins disappear (requiring login to see)

## API Endpoints Verification

```bash
# Test auth
curl http://localhost:7860/auth/me

# Test pins (requires COOKIE from login)
curl http://localhost:7860/api/pins
curl http://localhost:7860/api/pins/community
```

## Notes
- ⚠️ OAuth requires valid GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env
- Location permission may require HTTPS in production
- Database: SQLite (data/users.db) auto-created on first run
