import { terms } from '@drakkar.software/octovault-sdk';
import { LegalPage } from '@/components/LegalPage';

export default function TermsScreen() {
  return <LegalPage doc={terms} />;
}
