import type {
  Appointment, BloodGroup, BloodRequest, CatalogItem, DeviceReading, DonorProfile, EducationItem, HealthRecord, Medication, Message, User
} from "@health/shared";

const apiBase = import.meta.env.VITE_API_URL ?? "http://localhost:4000";
let sessionToken = localStorage.getItem("harbor-session-token");

export function setSessionToken(token: string | null) {
  sessionToken = token;
  localStorage.removeItem("harbor-demo-token");
  if (token) localStorage.setItem("harbor-session-token", token);
  else localStorage.removeItem("harbor-session-token");
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");
  if (sessionToken) headers.set("Authorization", `Bearer ${sessionToken}`);
  const response = await fetch(`${apiBase}${path}`, { ...init, headers });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.message ?? `Request failed (${response.status}).`);
  return result as T;
}

async function authenticate(path: "/api/auth/signup" | "/api/auth/login", input: object) {
  const result = await request<{ token: string; user: User; mode: string }>(path, {
    method: "POST", body: JSON.stringify(input)
  });
  setSessionToken(result.token);
  return result;
}

export const api = {
  signup: (input: { name: string; email: string; password: string; role: "patient" | "donor" | "volunteer"; referralCode?: string }) =>
    authenticate("/api/auth/signup", input),
  login: (input: { email: string; password: string }) => authenticate("/api/auth/login", input),
  me: () => request<{ user: User; mode: string }>("/api/me"),
  publicBloodRequests: () => request<{ data: BloodRequest[] }>("/api/public/blood-requests"),
  appointments: () => request<{ data: Appointment[] }>("/api/appointments"),
  createAppointment: (input: Pick<Appointment, "date" | "time" | "type" | "hospital" | "hospitalPhone">) =>
    request<{ data: Appointment }>("/api/appointments", { method: "POST", body: JSON.stringify(input) }),
  medications: () => request<{ data: Medication[] }>("/api/medications"),
  createMedication: (input: Omit<Medication, "id" | "clinicianReviewed" | "prescribedBy">) =>
    request<{ data: Medication }>("/api/medications", { method: "POST", body: JSON.stringify(input) }),
  records: () => request<{ data: HealthRecord[] }>("/api/records"),
  createRecord: (input: Omit<HealthRecord, "id" | "fileAvailable" | "patientId"> & { patientId?: string }) =>
    request<{ data: HealthRecord }>("/api/records", { method: "POST", body: JSON.stringify(input) }),
  deviceReadings: () => request<{ data: DeviceReading[] }>("/api/device-readings"),
  createDeviceReading: (input: Omit<DeviceReading, "id" | "patientId"> & { patientId?: string }) =>
    request<{ data: DeviceReading }>("/api/device-readings", { method: "POST", body: JSON.stringify(input) }),
  messages: () => request<{ data: Message[] }>("/api/messages"),
  sendMessage: (text: string) => request<{ data: Message }>("/api/messages", { method: "POST", body: JSON.stringify({ text }) }),
  assistantStatus: () => request<{ provider: string }>("/api/assistant/status"),
  askAssistant: (message: string, history: { role: "user" | "assistant"; content: string }[]) =>
    request<{ reply: string; provider: string }>("/api/assistant/chat", { method: "POST", body: JSON.stringify({ message, history }) }),
  users: () => request<{ data: User[] }>("/api/admin/users"),
  catalog: () => request<{ data: CatalogItem[] }>("/api/catalog"),
  checkout: (itemId: string) => request<{ message: string; transaction: string }>("/api/checkout", {
    method: "POST", body: JSON.stringify({ itemId, quantity: 1 })
  }),
  bloodRequests: () => request<{ data: BloodRequest[] }>("/api/blood-requests"),
  donorProfile: () => request<{ data: DonorProfile | null }>("/api/donors/profile"),
  matches: () => request<{ data: { donorId: string; bloodType: string; area: string }[] }>("/api/donors/matches"),
  saveDonorProfile: async (input: { name: string; phone: string; bloodType: BloodGroup; country: string; state: string; district: string; city: string; available: boolean; consent: boolean }) => {
    const result = await request<{ data: DonorProfile; token?: string }>("/api/donors/profile", { method: "POST", body: JSON.stringify(input) });
    if (result.token) setSessionToken(result.token);
    return result;
  },
  createBloodRequest: (input: { bloodType: BloodGroup; area: string; units: number; urgency: "Routine" | "Urgent" }) =>
    request<{ data: BloodRequest }>("/api/blood-requests", { method: "POST", body: JSON.stringify(input) }),
  volunteerReferralCode: () => request<{ code: string | null }>("/api/volunteers/referral-code"),
  education: () => request<{ data: EducationItem[] }>("/api/education")
};
