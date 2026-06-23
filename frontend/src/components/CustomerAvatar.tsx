import Avatar from '@mui/material/Avatar';
import { avatarColor, getInitials } from '../utils/avatar';

interface CustomerAvatarProps {
  name: string;
  size?: number;
}

export function CustomerAvatar({ name, size = 36 }: CustomerAvatarProps) {
  const fontSize = size >= 48 ? 20 : 14;
  return (
    <Avatar
      sx={{
        width: size,
        height: size,
        fontSize,
        fontWeight: 700,
        bgcolor: avatarColor(name),
      }}
    >
      {getInitials(name)}
    </Avatar>
  );
}
