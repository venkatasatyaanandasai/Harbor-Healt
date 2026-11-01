export const roles = ["patient", "caregiver", "clinician", "administrator", "donor", "volunteer"] as const;
export type Role = (typeof roles)[number];
export const bloodGroups = [
  "A+", "A-", "A1+", "A1-", "A1B+", "A1B-", "A2+", "A2-", "A2B+", "A2B-",
  "AB+", "AB-", "B+", "B-", "Bombay Blood Group", "INRA", "O+", "O-"
] as const;
export type BloodGroup = (typeof bloodGroups)[number];

export interface User {
  id: string;
  name: string;
  role: Role;
  clinic: string;
  initials: string;
  volunteerCode?: string;
}

export interface Appointment {
  id: string;
  patientId: string;
  patientName: string;
  clinician: string;
  type: string;
  date: string;
  time: string;
  status: "confirmed" | "requested";
  hospital?: string;
  hospitalPhone?: string;
}

export interface Medication {
  id: string;
  patientId: string;
  name: string;
  instructions: string;
  reminder: string;
  dose: string;
  frequency: string;
  quantity: number;
  prescribedBy?: string;
  clinicianReviewed: boolean;
}

export interface HealthRecord {
  id: string;
  patientId: string;
  title: string;
  category: string;
  date: string;
  fileAvailable: boolean;
  source?: string;
  summary?: string;
}

export interface DeviceReading {
  id: string;
  patientId: string;
  device: string;
  measurement: string;
  value: number;
  unit: string;
  recordedAt: string;
}

export interface Message {
  id: string;
  patientId: string;
  from: string;
  role: Role;
  text: string;
  date: string;
}

export interface CatalogItem {
  id: string;
  name: string;
  detail: string;
  priceLabel: string;
  demoOnly: true;
}

export interface BloodRequest {
  id: string;
  bloodType: BloodGroup;
  area: string;
  units: number;
  urgency: "Routine" | "Urgent";
  clinic: string;
  status?: "active" | "fulfilled" | "cancelled";
}

export interface DonorProfile {
  userId: string;
  name: string;
  phone: string;
  bloodType: BloodGroup;
  area: string;
  country: string;
  state: string;
  district: string;
  city: string;
  available: boolean;
  volunteerCode?: string;
}

export interface EducationItem {
  id: string;
  title: string;
  summary: string;
  reviewStatus: "sample-not-reviewed" | "clinician-reviewed";
  reviewedBy?: string;
  updated: string;
}
