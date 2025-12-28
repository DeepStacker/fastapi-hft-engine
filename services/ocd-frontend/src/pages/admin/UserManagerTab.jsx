/**
 * User Manager Tab Component
 * Admin user management: list users, toggle status, toggle admin role
 */
import { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import { UsersIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import adminService from '../../services/adminService';
import { Spinner } from '../../components/common';

const UserManagerTab = () => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);
    const theme = useSelector((state) => state.theme.theme);
    const isDark = theme === 'dark';

    const fetchUsers = useCallback(async () => {
        setLoading(true);
        try {
            const data = await adminService.listUsers(page, 10);
            setUsers(data.items || data.data || []);
            setTotalPages(data.pages || 1);
            setTotal(data.total || 0);
        } catch (err) {
            console.error('Failed to fetch users:', err);
            toast.error('Failed to load users');
        } finally {
            setLoading(false);
        }
    }, [page]);

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    const toggleUserStatus = async (userId, isActive) => {
        try {
            if (isActive) {
                await adminService.deactivateUser(userId);
            } else {
                await adminService.activateUser(userId);
            }
            toast.success(`User ${isActive ? 'deactivated' : 'activated'}`);
            fetchUsers();
        } catch {
            toast.error('Failed to update user status');
        }
    };

    const toggleAdminRole = async (user) => {
        const newRole = user.role === 'admin' ? 'user' : 'admin';
        const confirmMsg = newRole === 'admin'
            ? `Grant admin privileges to ${user.email}?`
            : `Revoke admin privileges from ${user.email}?`;

        if (!confirm(confirmMsg)) return;

        try {
            await adminService.updateUser(user.id, { role: newRole });
            toast.success(`${user.email} is now ${newRole === 'admin' ? 'an admin' : 'a regular user'}`);
            fetchUsers();
        } catch {
            toast.error('Failed to update user role');
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Spinner size="lg" />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-semibold">User Management</h3>
                    <p className="text-sm text-gray-500">{total} total users</p>
                </div>
                <button onClick={fetchUsers} className={`p-2 rounded-lg ${isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}>
                    <ArrowPathIcon className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            <div className="overflow-x-auto rounded-xl border dark:border-gray-700">
                <table className="w-full">
                    <thead className={isDark ? 'bg-gray-800' : 'bg-gray-50'}>
                        <tr>
                            <th className="text-left py-3 px-4">User</th>
                            <th className="text-left py-3 px-4">Role</th>
                            <th className="text-left py-3 px-4">Provider</th>
                            <th className="text-left py-3 px-4">Status</th>
                            <th className="text-left py-3 px-4">Last Login</th>
                            <th className="text-left py-3 px-4">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map((user) => (
                            <tr key={user.id} className={`border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                                <td className="py-3 px-4">
                                    <div className="flex items-center gap-3">
                                        {user.profile_image ? (
                                            <img src={user.profile_image} alt="" className="w-8 h-8 rounded-full" />
                                        ) : (
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}>
                                                <UsersIcon className="w-4 h-4" />
                                            </div>
                                        )}
                                        <div>
                                            <div className="font-medium">{user.username || user.email?.split('@')[0]}</div>
                                            <div className="text-xs text-gray-500">{user.email}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="py-3 px-4">
                                    <span className={`px-2 py-1 rounded text-xs font-medium ${user.role === 'admin' ? 'bg-purple-500 text-white' :
                                            user.role === 'premium' ? 'bg-yellow-500 text-black' :
                                                'bg-gray-500 text-white'
                                        }`}>
                                        {user.role?.toUpperCase()}
                                    </span>
                                </td>
                                <td className="py-3 px-4">
                                    <span className="text-sm">{user.login_provider || 'email'}</span>
                                </td>
                                <td className="py-3 px-4">
                                    <span className={`px-2 py-1 rounded text-xs ${user.is_active ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
                                        {user.is_active ? 'Active' : 'Inactive'}
                                    </span>
                                </td>
                                <td className="py-3 px-4 text-sm text-gray-500">
                                    {user.last_login ? new Date(user.last_login).toLocaleDateString() : 'Never'}
                                </td>
                                <td className="py-3 px-4">
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => toggleAdminRole(user)}
                                            className={`px-3 py-1 rounded text-xs font-medium ${user.role === 'admin'
                                                    ? 'bg-orange-500 hover:bg-orange-600 text-white'
                                                    : 'bg-purple-500 hover:bg-purple-600 text-white'
                                                }`}
                                        >
                                            {user.role === 'admin' ? 'Revoke Admin' : 'Make Admin'}
                                        </button>
                                        <button
                                            onClick={() => toggleUserStatus(user.id, user.is_active)}
                                            className={`px-3 py-1 rounded text-xs ${user.is_active ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'} text-white`}
                                        >
                                            {user.is_active ? 'Disable' : 'Enable'}
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {users.length === 0 && (
                            <tr><td colSpan="6" className="py-8 text-center text-gray-500">No users found.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
            <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Showing {users.length} of {total} users</span>
                <div className="flex gap-2">
                    <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 bg-gray-500 text-white rounded disabled:opacity-50">
                        Previous
                    </button>
                    <span className="px-3 py-1">Page {page} of {totalPages}</span>
                    <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-3 py-1 bg-gray-500 text-white rounded disabled:opacity-50">
                        Next
                    </button>
                </div>
            </div>
        </div>
    );
};

export default UserManagerTab;
