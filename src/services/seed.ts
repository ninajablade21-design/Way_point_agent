import type { Report } from '@/types';
import { repo } from './storage';

const SEED_REPORTS: Array<Omit<Report, 'id' | 'created_at' | 'updated_at'>> = [
  {
    user_id: null,
    title: 'Large pothole near MG Road junction',
    description: 'A deep pothole around 2 feet wide has formed near the MG Road and Brigade Road junction. Two-wheelers are swerving to avoid it, causing near-miss collisions during peak hours.',
    category: 'Pothole',
    severity: 'High',
    status: 'Under Review',
    location_name: 'MG Road, Bengaluru',
    latitude: 12.9756,
    longitude: 77.6066,
    image_url: null,
    classification_source: 'user',
    classification_confidence: 1.0,
  },
  {
    user_id: null,
    title: 'Waterlogging on Linking Road after heavy rain',
    description: 'Severe waterlogging on Linking Road near Bandra West. Water is knee-deep and vehicles are stalling. Needs immediate drainage attention.',
    category: 'Flooding',
    severity: 'Critical',
    status: 'Submitted',
    location_name: 'Linking Road, Mumbai',
    latitude: 19.0596,
    longitude: 72.8295,
    image_url: null,
    classification_source: 'user',
    classification_confidence: 1.0,
  },
  {
    user_id: null,
    title: 'Fallen tree blocking Anna Salai',
    description: 'A large tree has fallen across Anna Salai near the Gemini flyover, blocking one full lane. Traffic is backed up for over a kilometre.',
    category: 'Fallen Tree',
    severity: 'High',
    status: 'Submitted',
    location_name: 'Anna Salai, Chennai',
    latitude: 13.0394,
    longitude: 80.2519,
    image_url: null,
    classification_source: 'user',
    classification_confidence: 1.0,
  },
  {
    user_id: null,
    title: 'Streetlight not working on CP Inner Circle',
    description: 'Three consecutive streetlights are not working on the inner circle near Block A. The area is very dark at night and unsafe for pedestrians.',
    category: 'Broken Streetlight',
    severity: 'Medium',
    status: 'Resolved',
    location_name: 'Connaught Place, New Delhi',
    latitude: 28.6315,
    longitude: 77.2167,
    image_url: null,
    classification_source: 'user',
    classification_confidence: 1.0,
  },
  {
    user_id: null,
    title: 'Damaged road sign on Old Mahabalipuram Road',
    description: 'The directional signboard near Sholinganallur is bent and illegible. Drivers miss the turn and take long detours.',
    category: 'Damaged Sign',
    severity: 'Low',
    status: 'Under Review',
    location_name: 'OMR, Chennai',
    latitude: 12.9010,
    longitude: 80.2279,
    image_url: null,
    classification_source: 'user',
    classification_confidence: 1.0,
  },
  {
    user_id: null,
    title: 'Pothole on Hosur Road service lane',
    description: 'Multiple potholes along the service lane near Electronic City. Very dangerous for two-wheeler riders at night.',
    category: 'Pothole',
    severity: 'Medium',
    status: 'Submitted',
    location_name: 'Hosur Road, Bengaluru',
    latitude: 12.8452,
    longitude: 77.6602,
    image_url: null,
    classification_source: 'user',
    classification_confidence: 1.0,
  },
];

const SEED_FLAG = 'waypoint.seeded';

export async function seedDemoData(): Promise<void> {
  const existing = await repo.listReports();
  if (existing.length > 0) {
    return;
  }

  const flagged = localStorage.getItem(SEED_FLAG);
  if (flagged === 'true') return;

  for (const r of SEED_REPORTS) {
    const offset = Math.random() * 7 * 24 * 60 * 60 * 1000;
    const created = new Date(Date.now() - offset).toISOString();
    await repo.createReport({
      ...r,
      status: r.status as Report['status'],
    } as Omit<Report, 'id' | 'created_at' | 'updated_at'>);
  }
  localStorage.setItem(SEED_FLAG, 'true');
}
