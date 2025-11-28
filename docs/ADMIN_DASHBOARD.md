# Admin Dashboard - Complete Guide

## 🎯 Overview

The Stockify Admin Dashboard is a comprehensive web-based interface for managing your entire system. It provides real-time monitoring, log management, API analytics, service control, and system configuration - all in one place.

---

## 🚀 Features

### 1. **Real-Time System Monitoring** 📊
- Live CPU, memory, and disk usage
- Active WebSocket connections
- Cache hit rate
- System uptime
- Auto-refreshing every 2 seconds

### 2. **Comprehensive Log Viewer** 📋
- View all system logs in one place
- Filter by service, level (info/warning/error)
- Real-time log streaming
- Search functionality
- Export logs to CSV

### 3. **Alert Management** 🔔
- Create custom alert rules
- Set thresholds for CPU, memory, latency
- Multi-channel notifications (email, SMS, Slack)
- Alert history and tracking

### 4. **API Analytics** 📈
- Track usage for each endpoint
- Request/response times
- Error rates  
- Top endpoints by volume
- Time-series charts

### 5. **Service Management** ⚙️
- View all services status
- Start/stop/restart services
- View service logs
- Resource usage per service
- Health check status

### 6. **User Management** 👥
- View all users
- Enable/disable accounts
- Reset passwords
- Manage API keys
- View user activity

### 7. **Database Management** 💾
- Execute queries (read-only for safety)
- View table statistics
- Database size and growth
- Index performance
- Backup management

### 8. **Cache Management** 🗄️
- View cache statistics
- Flush cache
- Cache hit/miss rates
- Memory usage
- Key management

### 9. **Configuration Editor** ⚡
- Edit system configuration
- Real-time updates (no restart needed)
- Configuration validation
- Rollback capability
- Version history

### 10. **Quick Actions** 🎯
- Emergency stop button
- One-click cache flush
- Automated backups
- Health check trigger
- Log export

---

## 🛠️ Installation & Setup

### 1. Start Admin Backend

```bash
# Navigate to project directory
cd d:\Python\New_Stockify_project\DB_Ingestion

# Run admin service
python services/admin/main.py
```

The admin API will start on `http://localhost:8001`

### 2. Open Dashboard

Simply open the dashboard HTML file in your browser:

```bash
# Option 1: Direct file
start services/admin/dashboard.html

# Option 2: Serve via HTTP (recommended)
python -m http.server 3000 --directory services/admin
# Then open http://localhost:3000/dashboard.html
```

### 3. Login

Use your admin credentials:
- **Username**: admin
- **Password**: (from your .env file)

---

## 📱 Dashboard Sections

### Overview Page
- **System Stats Cards**: CPU, Memory, Disk, Connections
- **Real-time Charts**: 60-second rolling window
- **Quick Actions**: Frequently used commands
- **Active Alerts**: Current system alerts

### Logs Page
- **Live Log Stream**: Real-time logs as they happen
- **Search**: Find specific events
- **Filters**: By service, level, time range
- **Export**: Download logs for analysis

### Analytics Page
- **API Metrics**: Requests per endpoint
- **Performance**: Latency distributions
- **Error Tracking**: Error rates over time
- **User Activity**: Active users, new registrations

### Services Page
- **Service List**: All microservices
- **Status Indicators**: Running/stopped/error
- **Resource Usage**: CPU, memory per service
- **Actions**: Restart, view logs, change config

### Users Page
- **User List**: All registered users
- **Activity**: Last login, API usage
- **Management**: Enable/disable, reset password
- **API Keys**: View and revoke keys

### Database Page
- **Query Interface**: Run SELECT queries
- **Table Browser**: Explore data
- **Statistics**: Row counts, sizes
- **Backups**: Create and restore

### Configuration Page
- **All Settings**: Organized by category
- **Inline Editing**: Click to edit
- **Validation**: Immediate feedback
- **Restart Required**: Clear indicators

---

## 🔒 Security

### Authentication
- Admin-only access (JWT-based)
- Token expiration (30 minutes)
- Automatic re-authentication

### Authorization
- Role-based access control
- Admin permission required for all endpoints
- Audit logging of all actions

### Safety Features
- Read-only database queries
- Confirmation dialogs for destructive actions
- Rollback capability for config changes
- Automatic backups before changes

---

## 📊 API Endpoints

All admin endpoints are authenticated and require admin privileges.

### System Monitoring
```http
GET /system/stats
GET /system/realtime-stats (SSE stream)
```

### Log Management
```http
GET /logs?service=gateway&level=error&limit=100
GET /logs/stream (SSE stream)
```

### Alerts
```http
GET /alerts
POST /alerts
PUT /alerts/{alert_id}
DELETE /alerts/{alert_id}
```

### Analytics
```http
GET /analytics/endpoints?timeframe=24h
GET /analytics/users
```

### Services
```http
GET /services
POST /services/{service_name}/restart
```

### Database
```http
POST /database/query
GET /database/stats
```

### Cache
```http
GET /cache/stats
DELETE /cache/flush
```

### Users
```http
GET /users
PUT /users/{user_id}/toggle
```

### Configuration
```http
GET /config
PUT /config/{key}
```

---

## 🎨 Customization

### Dashboard Theme
Edit the CSS variables in `dashboard.html`:

```css
:root {
    --primary: #6366f1;     /* Primary color */
    --secondary: #8b5cf6;   /* Secondary color */
    --success: #10b981;     /* Success color */
    --warning: #f59e0b;     /* Warning color */
    --danger: #ef4444;      /* Danger color */
}
```

### Add Custom Widgets
Add new components to the dashboard:

```javascript
function MyCustomWidget() {
    return (
        <div className="card">
            <div className="card-header">My Widget</div>
            {/* Your content */}
        </div>
    );
}
```

---

## 📈 Performance Tips

1. **Adjust Refresh Rates**: Modify polling intervals in `dashboard.html`
2. **Limit Log History**: Reduce `limit` parameter in log queries
3. **Use Filtering**: Filter data on server-side, not client-side
4. **Cache Results**: Browser caches static assets

---

## 🔧 Troubleshooting

### Dashboard won't load
- Check if admin backend is running on port 8001
- Verify CORS settings in backend
- Check browser console for errors

### Authentication fails
- Verify admin credentials
- Check if JWT secret is correct
- Clear browser localStorage

### Real-time updates not working
- Check WebSocket/SSE connections  
- Verify firewall allows connections
- Check browser compatibility

### Services not showing
- Verify Docker is running
- Check service names match
- Ensure admin has permissions

---

## 🚀 Next Steps

### Immediate Enhancements
1. **Persistent Storage**: Save configs to database
2. **More Charts**: Add Chart.js visualizations
3. **Export Features**: CSV/JSON exports
4. **Dark Mode**: Toggle theme
5. **Mobile Responsive**: Optimize for phones

### Advanced Features
1. **Real-time Alerts**: Browser notifications
2. **Audit Trail**: Complete action history
3. **Backup Scheduler**: Automated backups
4. **Multi-tenancy**: Manage multiple environments
5. **Custom Dashboards**: User-defined layouts

---

## 💡 Best Practices

1. **Regular Monitoring**: Check dashboard daily
2. **Set Up Alerts**: Get notified of issues
3. **Review Logs**: Investigate errors promptly
4. **Backup Regularly**: Use automated backups
5. **Monitor Trends**: Track performance over time
6. **Update Config**: Test changes in dev first
7. **User Audits**: Review user activity monthly

---

## 📞 Support

For issues or questions:
1. Check logs in the dashboard
2. Review this documentation
3. Check GitHub issues
4. Contact support team

---

## 🎉 Conclusion

The Admin Dashboard gives you complete control over your Stockify system with:
- ✅ Real-time monitoring
- ✅ Comprehensive logging
- ✅ Service management
- ✅ User administration
- ✅ System configuration
- ✅ Performance analytics

**You can now manage your entire system from one beautiful interface!** 🚀

---

*Dashboard Version: 1.0.0*  
*Last Updated: 2025-11-28*
