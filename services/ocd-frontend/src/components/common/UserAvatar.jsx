

const UserAvatar = ({ user, size = 'md', className = '' }) => {
  // Generate initials from name
  const getInitials = (name) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Generate a consistent color based on username
  const getColorFromName = (name) => {
    if (!name) return '#6B7280'; // Default gray
    const colors = [
      '#F87171', // red
      '#FB923C', // orange
      '#FBBF24', // amber
      '#34D399', // emerald
      '#60A5FA', // blue
      '#818CF8', // indigo
      '#A78BFA', // violet
      '#F472B6', // pink
    ];
    
    const hash = name.split('').reduce((acc, char) => {
      return char.charCodeAt(0) + ((acc << 5) - acc);
    }, 0);
    
    return colors[Math.abs(hash) % colors.length];
  };

  // Size classes
  const sizeClasses = {
    sm: 'w-8 h-8 text-sm',
    md: 'w-12 h-12 text-lg',
    lg: 'w-20 h-20 text-2xl',
    xl: 'w-32 h-32 text-4xl'
  };

  const initials = getInitials(user?.username);
  const backgroundColor = getColorFromName(user?.username);

  if (user?.profile_image) {
    return (
      <div className={`relative ${sizeClasses[size]} ${className}`}>
        <img
          src={user.profile_image}
          alt={user.username}
          className="rounded-full w-full h-full object-cover"
        />
      </div>
    );
  }

  return (
    <div
      className={`flex items-center justify-center rounded-full font-semibold text-white ${sizeClasses[size]} ${className}`}
      style={{ backgroundColor }}
    >
      {initials}
    </div>
  );
};

export default UserAvatar;
