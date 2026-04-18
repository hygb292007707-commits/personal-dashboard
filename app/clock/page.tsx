import type { Metadata } from 'next';
import ClockClient from './ClockClient';

export const metadata: Metadata = {
  title: 'Saat — PersonalOS',
  description: 'Kronometre ve Zamanlayıcı ile zaman yönetimi.',
};

export default function ClockPage() {
  return <ClockClient />;
}
