export const firebaseConfig = {
  apiKey: 'AIzaSyAKyiy82QF-KsLpqpnPK4G6j3UNcGLKsAI',
  authDomain: 'gfc-pilot.firebaseapp.com',
  projectId: 'gfc-pilot',
  storageBucket: 'gfc-pilot.firebasestorage.app',
  messagingSenderId: '130652522028',
  appId: '1:130652522028:web:3f6eaf1a52b2a2b8a67389',
  measurementId: 'G-GMD32K8EHE'
};

/** Root collection — one document per applicant, extensible for future stages */
export const APPLICANTS_COLLECTION = 'applicants';

/** Admin-uploaded lead records from Excel imports */
export const LEADS_COLLECTION = 'leads';
