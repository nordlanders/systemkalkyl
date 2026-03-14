import { useAuth } from '@/hooks/useAuth';
import ChangePasswordDialog from './ChangePasswordDialog';

export default function ForcedPasswordChange() {
  const { passwordExpired, clearPasswordExpired } = useAuth();

  return (
    <ChangePasswordDialog
      open={passwordExpired}
      onOpenChange={(open) => {
        if (!open) clearPasswordExpired();
      }}
      forced
    />
  );
}
