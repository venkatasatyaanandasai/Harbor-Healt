import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import {
  Avatar, Badge, Button, Card, Input, Select, Spinner, Text, Textarea, Title1, Title2
} from "@fluentui/react-components";
import {
  Add24Regular, ArrowClockwise24Regular, CalendarLtr24Regular, Chat24Regular, CheckmarkCircle20Regular,
  ChevronRight20Regular, ClipboardTask24Regular, HeartPulse24Regular, Home24Regular, People24Regular,
  Location24Regular, Pill24Regular, ShieldCheckmark24Regular, ShoppingBag24Regular
} from "./icons";
import type { Appointment, BloodGroup, BloodRequest, CatalogItem, DeviceReading, DonorProfile, EducationItem, HealthRecord, Medication, Message, Role, User } from "@health/shared";
import { api, setSessionToken } from "./api";
import { citySuggestionsByCountry, countries, districtSuggestionsByCountry, donorBloodGroups, regionsByCountry } from "./data/donor-locations";

type View = "overview" | "nearby" | "appointments" | "medications" | "records" | "messages" | "community" | "catalog" | "education" | "admin";
interface DashboardData {
  appointments: Appointment[];
  medications: Medication[];
  records: HealthRecord[];
  deviceReadings: DeviceReading[];
  messages: Message[];
  bloodRequests: BloodRequest[];
  catalog: CatalogItem[];
  education: EducationItem[];
  users: User[];
  matches: { donorId: string; bloodType: string; area: string }[];
}

const emptyData: DashboardData = {
  appointments: [], medications: [], records: [], deviceReadings: [], messages: [], bloodRequests: [],
  catalog: [], education: [], users: [], matches: []
};

const roleLabel: Record<Role, string> = {
  patient: "Blood requester", caregiver: "Caregiver", clinician: "Clinician", administrator: "Administrator", donor: "Blood donor", volunteer: "Volunteer"
};
const greetings: Record<Role, string> = {
  patient: "Your care, in one place.",
  caregiver: "Supporting every step.",
  clinician: "Care team workspace.",
  administrator: "Community overview.",
  donor: "Your generosity matters.",
  volunteer: "Your time can help save lives."
};

const navItems: { id: View; label: string; icon: typeof Home24Regular; roles?: Role[] }[] = [
  { id: "overview", label: "Overview", icon: Home24Regular },
  { id: "nearby", label: "Nearby care", icon: Location24Regular },
  { id: "appointments", label: "Appointments", icon: CalendarLtr24Regular, roles: ["patient", "caregiver", "clinician", "administrator"] },
  { id: "medications", label: "Medications", icon: Pill24Regular, roles: ["patient", "caregiver", "clinician", "administrator"] },
  { id: "records", label: "Health records", icon: ClipboardTask24Regular, roles: ["patient", "caregiver", "clinician", "administrator"] },
  { id: "messages", label: "Care team", icon: Chat24Regular, roles: ["patient", "caregiver", "clinician", "administrator"] },
  { id: "community", label: "Donor network", icon: People24Regular, roles: ["patient", "donor", "volunteer", "clinician", "administrator"] },
  { id: "catalog", label: "Medicine catalog", icon: ShoppingBag24Regular, roles: ["patient", "caregiver"] },
  { id: "education", label: "Health education", icon: HeartPulse24Regular },
  { id: "admin", label: "Administration", icon: ShieldCheckmark24Regular, roles: ["administrator"] }
];

function formatDate(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function dateInputValue(value = new Date()) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function SectionTitle({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: ReactNode }) {
  return <div className="section-title">{<div>{eyebrow && <Text className="eyebrow">{eyebrow}</Text>}<Title2>{title}</Title2></div>}{action}</div>;
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [appMode, setAppMode] = useState("demo");
  const [view, setView] = useState<View>("community");
  const [data, setData] = useState<DashboardData>(emptyData);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [messageText, setMessageText] = useState("");
  const [donorName, setDonorName] = useState("");
  const [donorPhone, setDonorPhone] = useState("");
  const [donorBloodType, setDonorBloodType] = useState<BloodGroup | "">("");
  const [donorCountry, setDonorCountry] = useState("");
  const [donorState, setDonorState] = useState("");
  const [donorDistrict, setDonorDistrict] = useState("");
  const [donorCity, setDonorCity] = useState("");
  const [donorConsent, setDonorConsent] = useState(false);
  const [requestArea, setRequestArea] = useState("");
  const [requestBlood, setRequestBlood] = useState<BloodGroup>("O+");
  const [requestUnits, setRequestUnits] = useState(1);
  const [requestUrgency, setRequestUrgency] = useState<"Routine" | "Urgent">("Routine");
  const [checkoutItem, setCheckoutItem] = useState("");
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [authName, setAuthName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authRole, setAuthRole] = useState<"patient" | "donor" | "volunteer">("donor");
  const [referralCode, setReferralCode] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [publicRequests, setPublicRequests] = useState<BloodRequest[]>([]);
  const [publicRequestError, setPublicRequestError] = useState("");

  const loadData = useCallback(async (currentUser: User, currentMode: string) => {
    setLoading(true);
    setError("");
    try {
      if (currentMode === "production") {
        const [requests, profile] = await Promise.all([
          api.bloodRequests(),
          currentUser.role === "donor" ? api.donorProfile() : Promise.resolve({ data: null as DonorProfile | null })
        ]);
        setData({ ...emptyData, bloodRequests: requests.data });
        setPublicRequests(requests.data);
        if (profile.data) {
          setDonorName(profile.data.name);
          setDonorPhone(profile.data.phone);
          setDonorBloodType(profile.data.bloodType);
          setDonorCountry(profile.data.country);
          setDonorState(profile.data.state);
          setDonorDistrict(profile.data.district);
          setDonorCity(profile.data.city);
        }
        return;
      }
      const base = await Promise.all([
        api.appointments(), api.medications(), api.records(), api.deviceReadings(), api.messages(),
        api.bloodRequests(), api.catalog(), api.education()
      ]);
      const extra = await Promise.all([
        currentUser.role === "administrator" ? api.users() : Promise.resolve({ data: [] as User[] }),
        ["clinician", "administrator", "donor"].includes(currentUser.role)
          ? api.matches() : Promise.resolve({ data: [] as DashboardData["matches"] }),
        currentUser.role === "donor" ? api.donorProfile() : Promise.resolve({ data: null as DonorProfile | null })
      ]);
      setData({
        appointments: base[0].data, medications: base[1].data, records: base[2].data, deviceReadings: base[3].data,
        messages: base[4].data, bloodRequests: base[5].data, catalog: base[6].data,
        education: base[7].data, users: extra[0].data, matches: extra[1].data
      });
      setPublicRequests(base[5].data);
      if (extra[2].data) {
        setDonorName(extra[2].data.name);
        setDonorPhone(extra[2].data.phone);
        setDonorBloodType(extra[2].data.bloodType);
        setDonorCountry(extra[2].data.country);
        setDonorState(extra[2].data.state);
        setDonorDistrict(extra[2].data.district);
        setDonorCity(extra[2].data.city);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load your workspace.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("harbor-session-token");
    if (!token) return;
    api.me().then(({ user: current, mode }) => {
      setUser(current);
      setAppMode(mode);
      setView("community");
      void loadData(current, mode);
    }).catch(() => setSessionToken(null));
  }, [loadData]);

  useEffect(() => {
    api.publicBloodRequests().then((result) => {
      setPublicRequests(result.data);
      setPublicRequestError("");
    }).catch((reason: unknown) => {
      setPublicRequestError(reason instanceof Error ? reason.message : "Active requests are unavailable.");
    });
  }, []);

  const visibleNav = useMemo(() => navItems.filter((item) =>
    appMode === "production" ? ["overview", "community"].includes(item.id) : true
  ), [appMode]);
  const submitAuth = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setNotice("");
    setAuthBusy(true);
    try {
      const session = authMode === "login"
        ? await api.login({ email: authEmail, password: authPassword })
        : await api.signup({
          name: authName,
          email: authEmail,
          password: authPassword,
          role: authRole,
          ...(referralCode.trim() ? { referralCode: referralCode.trim() } : {})
        });
      setUser(session.user);
      setAppMode(session.mode);
      setView("community");
      await loadData(session.user, session.mode);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Your account request could not be completed.");
    } finally {
      setAuthBusy(false);
    }
  };
  const signOut = () => {
    setSessionToken(null);
    setUser(null);
    setData(emptyData);
    setAppMode("demo");
    setView("community");
    setError("");
  };
  const refresh = () => user && void loadData(user, appMode);
  const runAction = async (action: () => Promise<unknown>, success: string) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
      setNotice(success);
      if (user) await loadData(user, appMode);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "That action could not be completed.");
    } finally {
      setBusy(false);
    }
  };

  if (!user) {
    return <main className="public-donor-shell">
      <header className="public-donor-header">
        <div className="login-brand"><span className="brand-mark"><HeartPulse24Regular /></span><span>harbor<span className="brand-light">health</span></span></div>
        <div><Button appearance={authMode === "login" ? "primary" : "subtle"} onClick={() => { setAuthMode("login"); setError(""); }}>Sign in</Button><Button appearance={authMode === "signup" ? "primary" : "secondary"} onClick={() => { setAuthMode("signup"); setError(""); }}>Join the donor network</Button></div>
      </header>
      <div className="public-donor-content">
        <section className="public-donor-intro">
          <Badge appearance="tint" color="success" icon={<CheckmarkCircle20Regular />}>COMMUNITY BLOOD DONOR NETWORK</Badge>
          <Title1>One donation can make a difference.</Title1>
          <Text className="login-description">Find active blood requests, register as a donor, or volunteer to help connect your community.</Text>
          <div className="public-donor-assurance"><ShieldCheckmark24Regular /><span><b>Your contact details stay private.</b><br />Donor contact details are never shown in the public request list.</span></div>
          <Card className="public-request-card">
            <div className="panel-heading"><div><Text className="eyebrow">COMMUNITY NEEDS</Text><Title2>Active blood requests</Title2></div><Badge appearance="tint" color="informative">{publicRequests.length} active</Badge></div>
            {publicRequestError && <div className="nearby-status" role="status">{publicRequestError}</div>}
            {publicRequests.map((request) => <div className="request-row" key={request.id}>
              <span className="blood-type">{request.bloodType}</span>
              <div className="record-copy"><b>{request.units} {request.units === 1 ? "unit" : "units"} needed · {request.area}</b><small>{request.clinic}</small></div>
              <Badge appearance="tint" color={request.urgency === "Urgent" ? "danger" : "informative"}>{request.urgency}</Badge>
            </div>)}
            {!publicRequests.length && !publicRequestError && <EmptyState title="No active requests" detail="Check back later, or sign in to submit a request." />}
            <small className="public-request-foot">Requests show blood group, broad area and units only; no requester names or phone numbers are public.</small>
          </Card>
        </section>
        <Card className="login-card account-auth-card">
          <Text className="eyebrow">{authMode === "login" ? "WELCOME BACK" : "JOIN YOUR COMMUNITY"}</Text>
          <Title2>{authMode === "login" ? "Sign in" : "Create your account"}</Title2>
          <Text className="subtle-text">Use your email and password to access the donor network.</Text>
          <form className="account-auth-form" onSubmit={(event) => void submitAuth(event)}>
            {authMode === "signup" && <>
              <label>Full name<Input autoComplete="name" value={authName} onChange={(_, change) => setAuthName(change.value)} required maxLength={100} /></label>
              <label>Join as<Select value={authRole} onChange={(_, option) => setAuthRole(option.value as typeof authRole)}>
                <option value="donor">Blood donor</option><option value="volunteer">Volunteer</option><option value="patient">Request blood</option>
              </Select></label>
              {authRole === "volunteer" && <label>Volunteer referral code (optional)<Input value={referralCode} onChange={(_, change) => setReferralCode(change.value)} maxLength={32} placeholder="VOL-…" /></label>}
            </>}
            <label>Email<Input type="email" autoComplete="email" value={authEmail} onChange={(_, change) => setAuthEmail(change.value)} required maxLength={254} /></label>
            <label>Password<Input type="password" autoComplete={authMode === "login" ? "current-password" : "new-password"} value={authPassword} onChange={(_, change) => setAuthPassword(change.value)} required minLength={authMode === "signup" ? 12 : 1} maxLength={128} /></label>
            {authMode === "signup" && <small className="auth-hint">Use at least 12 characters. Volunteer referral codes are optional; volunteers receive a code after sign-up.</small>}
            {error && <div className="alert alert-error" role="alert">{error}</div>}
            <Button appearance="primary" type="submit" disabled={authBusy || !authEmail.trim() || !authPassword || (authMode === "signup" && (authName.trim().length < 2 || authPassword.length < 12))}>
              {authBusy ? "Please wait…" : authMode === "login" ? "Sign in" : "Create account"}
            </Button>
          </form>
          <small className="auth-hint">Local accounts are stored in a database file on this computer. For production accounts, configure PostgreSQL and complete a privacy and security review.</small>
          <Button appearance="subtle" onClick={() => { setAuthMode(authMode === "login" ? "signup" : "login"); setError(""); }}>
            {authMode === "login" ? "New here? Create an account" : "Already registered? Sign in"}
          </Button>
        </Card>
      </div>
      <footer className="login-footer">Harbor Health donor network · Not an emergency service · Call 112 in India for emergencies</footer>
    </main>;
  }

  const displayName = user.name.split(" ")[0];
  return <div className="app-shell">
    <aside className="sidebar">
      <div className="sidebar-brand"><span className="brand-mark"><HeartPulse24Regular /></span><span>harbor<span className="brand-light">health</span></span></div>
      <div className="demo-banner"><span className="demo-pulse" />{appMode === "production" ? "PRODUCTION ACCOUNT" : appMode === "local" ? "LOCAL ACCOUNT" : "SAMPLE DATA DEMO"}</div>
      <div className="nav-caption">WORKSPACE</div>
      <nav aria-label="Main navigation">
        {visibleNav.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => setView(id)} className={`nav-item ${view === id ? "active" : ""}`}>
          <Icon /><span>{label}</span>{id === "messages" && data.messages.length > 0 && <span className="nav-count">{data.messages.length}</span>}
        </button>)}
      </nav>
      {appMode !== "production" && <small className="nav-access-note">All pages are visible. Some actions are limited by your account role.</small>}
      <div className="sidebar-bottom">
        <div className="help-note"><span className="help-icon"><HeartPulse24Regular /></span><b>Here to help</b><small>Browse general health information or reach out to your care team.</small><button onClick={() => setView("education")}>Browse resources <ChevronRight20Regular /></button></div>
        <div className="profile-menu"><Avatar name={user.name} initials={user.initials} color="colorful" /><div className="profile-copy"><b>{user.name}</b><small>{roleLabel[user.role]}</small></div><button className="icon-button" aria-label="Sign out" onClick={signOut}>↗</button></div>
      </div>
    </aside>

    <main className={`main-area page-theme-${view}`}>
      <header className="topbar">
        <div className="breadcrumb">Harbor Community Clinic <ChevronRight20Regular /> <span>{visibleNav.find((n) => n.id === view)?.label ?? "Overview"}</span></div>
        <div className="top-actions">
          <Badge appearance="tint" color="success">{appMode === "production" ? "PRODUCTION ACCOUNT" : appMode === "local" ? "LOCAL ACCOUNT" : "DEMO MODE"}</Badge>
          <Button appearance="subtle" icon={<ArrowClockwise24Regular />} aria-label="Refresh data" onClick={refresh} />
          <Avatar name={user.name} initials={user.initials} size={32} color="colorful" />
        </div>
      </header>

      <div className={`page-content page-${view}`}>
        {error && <div className="alert alert-error" role="alert">{error}<button onClick={() => setError("")}>Dismiss</button></div>}
        {notice && <div className="alert alert-success" role="status">{notice}<button onClick={() => setNotice("")}>Dismiss</button></div>}
        {loading && <div className="loading-strip"><Spinner size="tiny" /> Updating your workspace…</div>}
        {view === "overview" && <Overview user={user} displayName={displayName} data={data} onNavigate={setView} />}
        {view === "nearby" && <NearbyCare />}
        {view === "appointments" && <Appointments data={data.appointments} role={user.role} busy={busy} onRequest={(input) => runAction(() => api.createAppointment(input), appMode === "local" ? "Appointment request saved to your local tracker. Contact the hospital directly to confirm; no payment was collected." : "Demo request recorded. No hospital was contacted and no payment was collected.")} />}
        {view === "medications" && <Medications data={data.medications} role={user.role} busy={busy} onCreate={(input) => runAction(() => api.createMedication(input), "Clinician-entered medication saved to the demo record.")} />}
        {view === "records" && <Records data={data.records} deviceReadings={data.deviceReadings} role={user.role} busy={busy}
          onAddRecord={(input) => runAction(() => api.createRecord(input), "Demo report summary added. No file was uploaded.")}
          onAddDevice={(input) => runAction(() => api.createDeviceReading(input), "Manual demo device reading added.")} />}
        {view === "messages" && <Messages data={data.messages} text={messageText} setText={setMessageText} busy={busy} onSend={() => {
          if (messageText.trim()) void runAction(() => api.sendMessage(messageText.trim()), "Your message has been sent to the care team.");
          setMessageText("");
        }} />}
        {view === "community" && <Community data={data} role={user.role} mode={appMode} volunteerCode={user.volunteerCode} donorName={donorName} donorPhone={donorPhone} donorBloodType={donorBloodType} donorCountry={donorCountry} donorState={donorState} donorDistrict={donorDistrict} donorCity={donorCity} donorConsent={donorConsent} setDonorConsent={setDonorConsent} setDonorName={setDonorName} setDonorPhone={setDonorPhone} setDonorBloodType={setDonorBloodType} setDonorCountry={(value) => { setDonorCountry(value); setDonorState(""); setDonorDistrict(""); setDonorCity(""); }} setDonorState={(value) => { setDonorState(value); setDonorDistrict(""); setDonorCity(""); }} setDonorDistrict={(value) => { setDonorDistrict(value); setDonorCity(""); }} setDonorCity={setDonorCity} requestBlood={requestBlood} requestUnits={requestUnits} requestUrgency={requestUrgency} requestArea={requestArea} setRequestBlood={(value) => setRequestBlood(value as BloodGroup)} setRequestUnits={setRequestUnits} setRequestUrgency={setRequestUrgency} setRequestArea={setRequestArea} busy={busy} onSaveDonor={() => donorBloodType && void runAction(() => api.saveDonorProfile({ name: donorName, phone: donorPhone, bloodType: donorBloodType, country: donorCountry, state: donorState, district: donorDistrict, city: donorCity, available: true, consent: donorConsent }), "Your donor profile has been saved.")} onRequestBlood={() => void runAction(() => api.createBloodRequest({ bloodType: requestBlood, area: requestArea, units: requestUnits, urgency: requestUrgency }), appMode === "production" ? "Blood request saved to active requests." : "Blood request added to the demo network.")} />}
        {view === "catalog" && <Catalog data={data.catalog} selected={checkoutItem} setSelected={setCheckoutItem} busy={busy} onCheckout={() => checkoutItem && void runAction(() => api.checkout(checkoutItem), "Demo checkout complete — no payment was collected.")} />}
        {view === "education" && <Education data={data.education} />}
        {view === "admin" && <Administration users={data.users} />}
      </div>
      <footer className="page-footer"><span>Harbor Health · Community care demo</span><span>This experience is not for emergencies and is not production-ready.</span></footer>
    </main>
  </div>;
}

function Overview({ user, displayName, data, onNavigate }: { user: User; displayName: string; data: DashboardData; onNavigate: (view: View) => void }) {
  const firstAppointment = data.appointments[0];
  return <>
    <div className="welcome-row">
      <div><Text className="eyebrow">{roleLabel[user.role].toUpperCase()} WORKSPACE · HARBOR COMMUNITY CLINIC</Text><Title1>{greetings[user.role]}</Title1><Text className="welcome-sub">Good to see you, {displayName}. Here’s what’s happening today.</Text></div>
      <Button appearance="primary" icon={<Add24Regular />} onClick={() => onNavigate(user.role === "donor" ? "community" : "appointments")}>{user.role === "donor" ? "My donor profile" : "Request an appointment"}</Button>
    </div>
    <div className="stat-grid">
      <StatCard icon={<CalendarLtr24Regular />} label="Upcoming visits" value={String(data.appointments.length).padStart(2, "0")} note={firstAppointment ? `Next · ${formatDate(firstAppointment.date)}` : "Nothing scheduled"} tone="mint" />
      <StatCard icon={<Pill24Regular />} label="Medication reminders" value={String(data.medications.length).padStart(2, "0")} note="Check your care plan" tone="blue" />
      <StatCard icon={<ClipboardTask24Regular />} label="Recent records" value={String(data.records.length).padStart(2, "0")} note="Shared with your care team" tone="sand" />
      <StatCard icon={<Chat24Regular />} label="Care team messages" value={String(data.messages.length).padStart(2, "0")} note="Your care team is here" tone="lavender" />
    </div>
    <div className="dashboard-grid">
      <Card className="panel-card appointments-panel">
        <div className="panel-heading"><div><Text className="eyebrow">YOUR SCHEDULE</Text><Title2>Upcoming appointments</Title2></div><Button appearance="subtle" onClick={() => onNavigate("appointments")}>View all <ChevronRight20Regular /></Button></div>
        {data.appointments.length ? data.appointments.slice(0, 2).map((item) => <div className="appointment-row" key={item.id}>
          <div className="date-tile"><b>{new Date(`${item.date}T12:00:00`).getDate()}</b><small>{new Date(`${item.date}T12:00:00`).toLocaleDateString(undefined, { month: "short" }).toUpperCase()}</small></div>
          <div className="appointment-copy"><b>{item.type}</b><small>{item.clinician} · {item.time}</small></div><Badge appearance="tint" color={item.status === "confirmed" ? "success" : "informative"}>{item.status === "confirmed" ? "Confirmed" : "Requested"}</Badge>
        </div>) : <EmptyState title="A little breathing room" detail="Your upcoming visits will show here." />}
        <button className="text-link" onClick={() => onNavigate("appointments")}><Add24Regular /> Request a visit</button>
      </Card>
      <Card className="guidance-card">
        <div className="guidance-top"><span className="guidance-icon"><HeartPulse24Regular /></span><Badge appearance="tint" color="informative">EDUCATION</Badge></div>
        <Text className="eyebrow">A GENTLE REMINDER</Text><Title2>Small steps count.</Title2>
        <Text className="guidance-copy">Explore general health information and learn when to seek urgent help.</Text>
        <Button appearance="secondary" onClick={() => onNavigate("education")}>Explore health education <ChevronRight20Regular /></Button>
        <small className="guidance-foot">Educational information only · Not a diagnosis</small>
      </Card>
      <Card className="panel-card records-panel">
        <div className="panel-heading"><div><Text className="eyebrow">YOUR HEALTH JOURNEY</Text><Title2>Recent records</Title2></div><Button appearance="subtle" onClick={() => onNavigate("records")}>All records <ChevronRight20Regular /></Button></div>
        {data.records.slice(0, 3).map((record) => <div className="record-row" key={record.id}><span className="record-icon"><ClipboardTask24Regular /></span><span className="record-copy"><b>{record.title}</b><small>{record.category} · {formatDate(record.date)}</small></span><ChevronRight20Regular /></div>)}
        {!data.records.length && <EmptyState title="Records will appear here" detail="Your care team can share visit summaries and test results." />}
      </Card>
      <Card className="message-card">
        <div className="message-card-head"><span className="message-icon"><Chat24Regular /></span><div><Text className="eyebrow">HERE FOR YOU</Text><Title2>Care team</Title2></div></div>
        <Text className="message-preview">{data.messages[0]?.text ?? "Start a conversation with your care team whenever you need support."}</Text>
        <Button appearance="primary" onClick={() => onNavigate("messages")}>Open messages <ChevronRight20Regular /></Button>
        <small className="message-time">Messages are not monitored for emergencies</small>
      </Card>
    </div>
    <div className="overview-lower">
      <div className="safety-strip"><span>ℹ</span><div><b>Need urgent help?</b><small>In India, call <a href="tel:112">112 for emergency assistance</a>. This demo is not monitored for emergencies.</small></div></div>
      <button className="quick-link" onClick={() => onNavigate("nearby")}><span className="quick-icon"><Location24Regular /></span><span><b>Find nearby care</b><small>Health centres, clinics & hospitals</small></span><ChevronRight20Regular /></button>
    </div>
  </>;
}

type NearbyCategory = "all" | "primary" | "health-centre" | "clinic" | "hospital" | "mobile" | "lab" | "pharmacy";
type FacilityKind = Exclude<NearbyCategory, "all">;
const indiaEmergencyContacts = [
  { label: "Police", numbers: ["112"] },
  { label: "Fire and Rescue", numbers: ["101"] },
  { label: "Ambulance", numbers: ["108"] },
  { label: "Women Helpline", numbers: ["181", "112"] },
  { label: "Cyber Crime Helpline", numbers: ["1930"] },
  { label: "Child Helpline", numbers: ["1098"] },
  { label: "Elder Helpline (Senior Citizens)", numbers: ["14567"] }
];
interface OSMElement {
  id: number;
  type: string;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}
interface NearbyFacility extends OSMElement {
  name: string;
  category: FacilityKind;
  distanceKm: number;
  latitude: number;
  longitude: number;
}

const nearbyCategoryLabels: Record<FacilityKind, string> = {
  primary: "Primary health centre",
  "health-centre": "Health centre",
  clinic: "Clinic",
  hospital: "Hospital",
  mobile: "Mobile health unit",
  lab: "Laboratory",
  pharmacy: "Pharmacy"
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseOSMElement(value: unknown): OSMElement | null {
  if (!isRecord(value) || typeof value.id !== "number" || typeof value.type !== "string") return null;
  const center = isRecord(value.center) && typeof value.center.lat === "number" && typeof value.center.lon === "number"
    ? { lat: value.center.lat, lon: value.center.lon }
    : undefined;
  const tags = isRecord(value.tags)
    ? Object.fromEntries(Object.entries(value.tags).filter((entry): entry is [string, string] => typeof entry[1] === "string"))
    : undefined;
  return {
    id: value.id,
    type: value.type,
    ...(typeof value.lat === "number" ? { lat: value.lat } : {}),
    ...(typeof value.lon === "number" ? { lon: value.lon } : {}),
    ...(center ? { center } : {}),
    ...(tags ? { tags } : {})
  };
}

function classifyFacility(tags: Record<string, string>): FacilityKind | null {
  const name = `${tags.name ?? ""} ${tags["name:en"] ?? ""}`.toLowerCase();
  const healthcare = (tags.healthcare ?? "").toLowerCase();
  const amenity = (tags.amenity ?? "").toLowerCase();
  const mobile = tags.mobile?.toLowerCase() === "yes" || healthcare === "mobile_clinic" ||
    /mobile (health|medical|clinic)/.test(name);
  if (mobile) return "mobile";
  if (/primary health|primary care|\bphc\b/.test(name) ||
      ["primary_care", "primary_healthcare"].includes(healthcare)) return "primary";
  if (/health cent(re|er)|community health|\bchc\b/.test(name) ||
      ["health_centre", "health_post"].includes(amenity) ||
      ["centre", "health_centre", "health_post"].includes(healthcare)) return "health-centre";
  if (amenity === "hospital" || healthcare === "hospital") return "hospital";
  if (amenity === "clinic" || ["clinic", "doctor"].includes(healthcare) || amenity === "doctors") return "clinic";
  if (amenity === "pharmacy" || healthcare === "pharmacy") return "pharmacy";
  if (["laboratory", "lab"].includes(amenity) || ["laboratory", "lab"].includes(healthcare)) return "lab";
  return null;
}

function distanceBetween(lat1: number, lon1: number, lat2: number, lon2: number) {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const latitudeDelta = radians(lat2 - lat1);
  const longitudeDelta = radians(lon2 - lon1);
  const value = Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(longitudeDelta / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function getCurrentLocation(): Promise<{ latitude: number; longitude: number }> {
  if (!navigator.geolocation) return Promise.reject(new Error("Location is unavailable in this browser."));
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({ latitude: coords.latitude, longitude: coords.longitude }),
      reject,
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
    );
  });
}

function locationErrorMessage(reason: unknown) {
  if (isRecord(reason) && typeof reason.code === "number") {
    if (reason.code === 1) return "Location permission was denied. Allow location access in your browser and try again.";
    if (reason.code === 3) return "Your location could not be determined in time. Please try again.";
    return "Your location is unavailable. Check your device settings and try again.";
  }
  return reason instanceof Error ? reason.message : "Nearby facilities could not be loaded. Please try again.";
}

async function findNearbyFacilities(latitude: number, longitude: number): Promise<NearbyFacility[]> {
  const query = `[out:json][timeout:25];(nwr["amenity"~"^(hospital|clinic|doctors|health_centre|health_post|pharmacy|laboratory)$"](around:10000,${latitude},${longitude});nwr["healthcare"~"^(hospital|clinic|centre|health_centre|primary_care|primary_healthcare|doctor|health_post|mobile_clinic|pharmacy|laboratory|lab)$"](around:10000,${latitude},${longitude});nwr["mobile"="yes"](around:10000,${latitude},${longitude}););out center tags;`;
  const response = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`, {
    headers: { Accept: "application/json" }
  });
  if (!response.ok) throw new Error("The OpenStreetMap search service is temporarily unavailable. Please try again later.");
  const payload: unknown = await response.json();
  if (!isRecord(payload) || !Array.isArray(payload.elements)) {
    throw new Error("The nearby search returned an unexpected response. Please try again later.");
  }
  return payload.elements.flatMap((item): NearbyFacility[] => {
    const element = parseOSMElement(item);
    const tags = element?.tags;
    if (!element || !tags) return [];
    const coordinates = element.center ?? (
      typeof element.lat === "number" && typeof element.lon === "number"
        ? { lat: element.lat, lon: element.lon }
        : null
    );
    const classified = classifyFacility(tags);
    if (!coordinates || !classified) return [];
    return [{
      ...element,
      name: tags.name ?? tags["name:en"] ?? nearbyCategoryLabels[classified],
      category: classified,
      latitude: coordinates.lat,
      longitude: coordinates.lon,
      distanceKm: distanceBetween(latitude, longitude, coordinates.lat, coordinates.lon)
    }];
  }).sort((first, second) => first.distanceKm - second.distanceKm);
}

function NearbyCare() {
  const [facilities, setFacilities] = useState<NearbyFacility[]>([]);
  const [category, setCategory] = useState<NearbyCategory>("all");
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [statusMessage, setStatusMessage] = useState("");

  const findNearby = async () => {
    setStatus("loading");
    setStatusMessage("");
    try {
      const { latitude, longitude } = await getCurrentLocation();
      const found = await findNearbyFacilities(latitude, longitude);
      setFacilities(found);
      setStatus("ready");
      setStatusMessage(found.length
        ? `Found ${found.length} listed ${found.length === 1 ? "facility" : "facilities"} within 10 km.`
        : "No matching facilities were listed within 10 km. OpenStreetMap coverage may be incomplete.");
    } catch (reason) {
      setStatus("error");
      setStatusMessage(locationErrorMessage(reason));
    }
  };

  const visibleFacilities = facilities.filter((facility) => category === "all" || facility.category === category);
  const categories: NearbyCategory[] = ["all", "primary", "health-centre", "clinic", "hospital", "mobile", "lab", "pharmacy"];
  return <section>
    <SectionTitle eyebrow="COMMUNITY SERVICES · INDIA" title="Nearby care" action={<Badge appearance="tint" color="informative">OpenStreetMap listings</Badge>} />
    <div className="nearby-emergency">
      <div><Text className="eyebrow">EMERGENCY ASSISTANCE · INDIA</Text><b>Call 112 for emergency help</b><small>India’s national emergency number. If you are in immediate danger, call now; this demo is not an emergency service.</small></div>
      <a className="emergency-call" href="tel:112">Call 112</a>
    </div>
    <Card className="emergency-contacts panel-card">
      <div className="panel-heading"><div><Text className="eyebrow">INDIA HELPLINES</Text><Title2>Emergency contacts</Title2></div><Badge appearance="tint" color="warning">Call directly</Badge></div>
      <div className="emergency-contact-list">{indiaEmergencyContacts.map((contact) => <div className="emergency-contact-row" key={contact.label}>
        <b>{contact.label}</b>
        <span>{contact.numbers.map((number, index) => <span key={number}><a href={`tel:${number}`}>{number}</a>{index < contact.numbers.length - 1 ? " / " : ""}</span>)}</span>
      </div>)}</div>
      <small className="emergency-disclaimer">Helpline availability and coverage can vary. In an immediate emergency, call 112.</small>
    </Card>
    <Card className="nearby-search panel-card">
      <div><Text className="eyebrow">CARE CLOSE TO YOU</Text><Title2>Find health services nearby</Title2><Text className="subtle-text">Search for primary health centres, health centres, clinics, hospitals, and mobile health units within 10 km.</Text></div>
      <Button appearance="primary" icon={<Location24Regular />} onClick={() => void findNearby()} disabled={status === "loading"}>
        {status === "loading" ? "Searching nearby…" : status === "ready" ? "Search again" : "Use my location"}
      </Button>
      <small className="nearby-privacy">Your browser will ask for location permission. If you continue, your coordinates are sent to the public OpenStreetMap search service to find nearby listings; this app does not save them.</small>
    </Card>
    {statusMessage && <div className={`nearby-status ${status === "error" ? "nearby-error" : ""}`} role={status === "error" ? "alert" : "status"}>{statusMessage}</div>}
    {status === "ready" && facilities.length > 0 && <>
      <div className="nearby-filters">
        <label htmlFor="nearby-category">Show</label>
        <Select id="nearby-category" value={category} onChange={(_, option) => setCategory(option.value as NearbyCategory)}>
          {categories.map((item) => <option key={item} value={item}>{item === "all" ? "All facilities" : nearbyCategoryLabels[item]}</option>)}
        </Select>
        <span>Sorted by distance</span>
      </div>
      {visibleFacilities.length ? <div className="nearby-grid">
        {visibleFacilities.map((facility) => {
          const phone = facility.tags?.phone ?? facility.tags?.["contact:phone"];
          const phoneLink = phone?.replace(/[^\d+*#,;]/g, "");
          const mapUrl = `https://www.openstreetmap.org/?mlat=${facility.latitude}&mlon=${facility.longitude}#map=17/${facility.latitude}/${facility.longitude}`;
          return <Card className="nearby-card" key={`${facility.type}-${facility.id}`}>
            <Badge appearance="tint" color="success">{nearbyCategoryLabels[facility.category]}</Badge>
            <Title2>{facility.name}</Title2>
            <Text className="nearby-distance">{facility.distanceKm < 1 ? `${Math.round(facility.distanceKm * 1000)} m away` : `${facility.distanceKm.toFixed(1)} km away`}</Text>
            {phone && <a className="nearby-phone" href={`tel:${phoneLink}`}>Call {phone}</a>}
            <a className="nearby-map" href={mapUrl} target="_blank" rel="noreferrer">View map <ChevronRight20Regular /></a>
          </Card>;
        })}
      </div> : <EmptyState title="No facilities in this category" detail="Try another category or show all nearby facilities." />}
    </>}
    <small className="nearby-attribution">Map data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a> (ODbL). Facility names and contact details may be missing, incomplete, or out of date. Confirm details before travelling. Mobile units may not be listed.</small>
  </section>;
}

function StatCard({ icon, label, value, note, tone }: { icon: ReactNode; label: string; value: string; note: string; tone: string }) {
  return <Card className="stat-card"><div className={`stat-icon ${tone}`}>{icon}</div><Text className="stat-label">{label}</Text><div className="stat-value">{value}</div><Text className="stat-note">{note}</Text></Card>;
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return <div className="empty-state"><span className="empty-graphic"><ClipboardTask24Regular /></span><b>{title}</b><small>{detail}</small></div>;
}

function Appointments({ data, role, busy, onRequest }: {
  data: Appointment[];
  role: Role;
  busy: boolean;
  onRequest: (input: Pick<Appointment, "date" | "time" | "type" | "hospital" | "hospitalPhone">) => void;
}) {
  const [type, setType] = useState("Primary care visit");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("10:00 AM");
  const [hospitals, setHospitals] = useState<NearbyFacility[]>([]);
  const [hospital, setHospital] = useState("");
  const [searchingHospitals, setSearchingHospitals] = useState(false);
  const [hospitalSearchError, setHospitalSearchError] = useState("");
  const canRequest = ["patient", "caregiver", "administrator"].includes(role);
  const selectedHospital = hospitals.find((item) =>
    `${item.name} · ${item.distanceKm.toFixed(1)} km` === hospital
  );
  const searchHospitals = async () => {
    setSearchingHospitals(true);
    setHospitalSearchError("");
    try {
      const { latitude, longitude } = await getCurrentLocation();
      const found = (await findNearbyFacilities(latitude, longitude)).filter((item) => item.category === "hospital");
      setHospitals(found);
      setHospital(found[0] ? `${found[0].name} · ${found[0].distanceKm.toFixed(1)} km` : "");
      if (!found.length) setHospitalSearchError("No nearby hospitals were found in OpenStreetMap. You may search again or use the manual contact list.");
    } catch (reason) {
      setHospitalSearchError(locationErrorMessage(reason));
    } finally {
      setSearchingHospitals(false);
    }
  };
  return <section><SectionTitle eyebrow="PLAN AHEAD" title="Appointments" action={canRequest && <Badge appearance="tint" color="success">Request a visit below</Badge>} />
    <div className="content-columns"><Card className="panel-card"><div className="panel-heading"><div><Text className="eyebrow">YOUR SCHEDULE</Text><Title2>Upcoming & recent</Title2></div><CalendarLtr24Regular /></div>
      {data.map((item) => <div className="appointment-row list-row" key={item.id}><div className="date-tile"><b>{new Date(`${item.date}T12:00:00`).getDate()}</b><small>{new Date(`${item.date}T12:00:00`).toLocaleDateString(undefined, { month: "short" }).toUpperCase()}</small></div><div className="appointment-copy"><b>{item.type}</b><small>{item.hospital ?? item.clinician} · {item.patientName} · {item.time}</small><small>Request ID: {item.id} · {item.status === "requested" ? "Awaiting hospital confirmation" : "Confirmed"}</small>{item.hospitalPhone && <a className="nearby-phone" href={`tel:${item.hospitalPhone.replace(/[^\d+*#,;]/g, "")}`}>Call hospital: {item.hospitalPhone}</a>}<small>OP payment: Not configured; no payment was collected.</small></div><Badge appearance="tint" color={item.status === "confirmed" ? "success" : "informative"}>{item.status}</Badge></div>)}
      {!data.length && <EmptyState title="No appointments yet" detail="Your upcoming visits will appear here." />}
    </Card>
    {canRequest && <Card className="form-card"><Text className="eyebrow">HOSPITAL APPOINTMENT REQUEST</Text><Title2>Request an appointment</Title2><Text className="subtle-text">This tracker records your request but does not send it to or reserve a slot at the hospital. Call the hospital directly to confirm.</Text><Button appearance="secondary" icon={<Location24Regular />} onClick={() => void searchHospitals()} disabled={searchingHospitals}>{searchingHospitals ? "Finding hospitals…" : "Find nearby hospitals"}</Button>
      {hospitalSearchError && <Text className="field-error" role="status">{hospitalSearchError}</Text>}
      <label>Hospital name<Input value={hospital} onChange={(_, change) => setHospital(change.value)} placeholder="Choose a nearby hospital or enter its name" /></label>
      {hospitals.length > 0 && <>
        <label>Nearby hospital listings<Select value={hospital} onChange={(_, option) => setHospital(option.value)}><option value="">Choose a listing</option>{hospitals.map((item) => <option key={`${item.type}-${item.id}`} value={`${item.name} · ${item.distanceKm.toFixed(1)} km`}>{item.name} · {item.distanceKm.toFixed(1)} km</option>)}</Select></label>
        <div className="nearby-grid">{hospitals.map((item) => {
          const phone = item.tags?.phone ?? item.tags?.["contact:phone"];
          const mapUrl = `https://www.openstreetmap.org/?mlat=${item.latitude}&mlon=${item.longitude}#map=17/${item.latitude}/${item.longitude}`;
          return <Card className="nearby-card" key={`${item.type}-${item.id}`}><Badge appearance="tint" color="success">Hospital</Badge><Title2>{item.name}</Title2><Text className="nearby-distance">{item.distanceKm < 1 ? `${Math.round(item.distanceKm * 1000)} m away` : `${item.distanceKm.toFixed(1)} km away`}</Text>{phone && <a className="nearby-phone" href={`tel:${phone.replace(/[^\d+*#,;]/g, "")}`}>Call {phone}</a>}<a className="nearby-map" href={mapUrl} target="_blank" rel="noreferrer">View map</a></Card>;
        })}</div>
      </>}
      <label>Visit type<Input value={type} onChange={(_, change) => setType(change.value)} /></label><label>Preferred date<Input type="date" value={date} onChange={(_, change) => setDate(change.value)} /></label><label>Preferred time<Select value={time} onChange={(_, option) => setTime(option.value)}><option value="9:00 AM">9:00 AM</option><option value="10:00 AM">10:00 AM</option><option value="2:00 PM">2:00 PM</option><option value="3:30 PM">3:30 PM</option></Select></label>
      <div className="payment-demo-note"><b>Razorpay OP payment</b><small>Payments are unavailable until the selected hospital supplies its official Razorpay appointment/fee integration and approved credentials. No charge is initiated here.</small></div>
      <Button appearance="primary" disabled={!date || !hospital || busy} onClick={() => onRequest({ date, time, type, hospital, ...(selectedHospital?.tags?.phone ?? selectedHospital?.tags?.["contact:phone"] ? { hospitalPhone: selectedHospital.tags.phone ?? selectedHospital.tags["contact:phone"] } : {}) })}>{busy ? "Saving request…" : "Track appointment request"}</Button>
    </Card>}
    </div>
  </section>;
}

function Medications({ data, role, busy, onCreate }: {
  data: Medication[];
  role: Role;
  busy: boolean;
  onCreate: (input: Omit<Medication, "id" | "clinicianReviewed">) => void;
}) {
  const [name, setName] = useState("");
  const [dose, setDose] = useState("");
  const [frequency, setFrequency] = useState("");
  const [quantity, setQuantity] = useState("");
  const [instructions, setInstructions] = useState("");
  const [reminder, setReminder] = useState("");
  const canPrescribe = ["clinician", "administrator"].includes(role);
  return <section><SectionTitle eyebrow="DAILY CARE" title="Medications & reminders" action={<Badge appearance="tint" color="informative">Follow your clinician’s instructions</Badge>} />
    <div className="content-columns">
      <Card className="panel-card"><div className="panel-heading"><div><Text className="eyebrow">YOUR LIST</Text><Title2>Medication reminders</Title2></div><Pill24Regular /></div>
        <div className="safety-strip compact"><span>ℹ</span><div><b>Clinician-entered details only</b><small>Use the exact prescription from a licensed clinician. This demo does not recommend medicines or verify dose safety.</small></div></div>
        {data.map((item) => <div className="med-row" key={item.id}><span className="med-icon"><Pill24Regular /></span><div className="record-copy"><b>{item.name}</b><small>{item.dose} · {item.frequency} · Quantity: {item.quantity} units</small><small>{item.instructions}{item.prescribedBy ? ` · Entered by ${item.prescribedBy}` : ""}</small></div><Badge appearance="outline">{item.reminder}</Badge></div>)}
        {!data.length && <EmptyState title="No medication reminders" detail={role === "patient" ? "Medication details will appear here after your clinician enters them." : "No clinician-entered medications are available for this profile."} />}
      </Card>
      {canPrescribe && <Card className="form-card"><Text className="eyebrow">CLINICIAN WORKFLOW · DEMO PATIENT</Text><Title2>Add prescribed medication</Title2><Text className="subtle-text">Enter only the directions already prescribed by the treating clinician. Quantity is the number of units prescribed/dispensed.</Text>
        <label>Medication name<Input value={name} onChange={(_, change) => setName(change.value)} /></label>
        <label>Dose as prescribed<Input value={dose} onChange={(_, change) => setDose(change.value)} placeholder="Enter exactly as prescribed" /></label>
        <label>Frequency<Input value={frequency} onChange={(_, change) => setFrequency(change.value)} placeholder="For example, the prescribed schedule" /></label>
        <label>Quantity in units<Input type="number" min="1" step="1" value={quantity} onChange={(_, change) => setQuantity(change.value)} /></label>
        <label>Reminder time / schedule<Input value={reminder} onChange={(_, change) => setReminder(change.value)} placeholder="Clinician-provided reminder schedule" /></label>
        <label>Additional instructions<Input value={instructions} onChange={(_, change) => setInstructions(change.value)} /></label>
        <Button appearance="primary" disabled={busy || name.trim().length < 2 || !dose.trim() || !frequency.trim() || !Number.isInteger(Number(quantity)) || Number(quantity) < 1 || !reminder.trim() || instructions.trim().length < 2}
          onClick={() => onCreate({ patientId: "u-patient", name: name.trim(), dose: dose.trim(), frequency: frequency.trim(), quantity: Number(quantity), reminder: reminder.trim(), instructions: instructions.trim() })}>
          {busy ? "Saving…" : "Save clinician-entered medication"}
        </Button>
      </Card>}
    </div>
  </section>;
}

function Records({ data, deviceReadings, role, busy, onAddRecord, onAddDevice }: {
  data: HealthRecord[];
  deviceReadings: DeviceReading[];
  role: Role;
  busy: boolean;
  onAddRecord: (input: Omit<HealthRecord, "id" | "fileAvailable" | "patientId"> & { patientId?: string }) => void;
  onAddDevice: (input: Omit<DeviceReading, "id" | "patientId"> & { patientId?: string }) => void;
}) {
  const [labs, setLabs] = useState<NearbyFacility[]>([]);
  const [labSearchStatus, setLabSearchStatus] = useState("");
  const [labSearchBusy, setLabSearchBusy] = useState(false);
  const [reportTitle, setReportTitle] = useState("");
  const [reportLab, setReportLab] = useState("");
  const [reportDate, setReportDate] = useState(dateInputValue());
  const [reportSummary, setReportSummary] = useState("");
  const [device, setDevice] = useState("Smartwatch");
  const [measurement, setMeasurement] = useState("");
  const [readingValue, setReadingValue] = useState("");
  const [readingUnit, setReadingUnit] = useState("");
  const [readingDate, setReadingDate] = useState(dateInputValue());
  const canEnter = ["patient", "caregiver", "clinician", "administrator"].includes(role);
  const patientId = ["clinician", "administrator"].includes(role) ? "u-patient" : undefined;

  const findLabs = async () => {
    setLabSearchBusy(true);
    setLabSearchStatus("");
    try {
      const { latitude, longitude } = await getCurrentLocation();
      const found = (await findNearbyFacilities(latitude, longitude)).filter((item) => item.category === "lab");
      setLabs(found);
      setLabSearchStatus(found.length ? `Found ${found.length} listed laboratories within 10 km.` : "No laboratories were listed within 10 km. OpenStreetMap coverage may be incomplete.");
    } catch (reason) {
      setLabSearchStatus(locationErrorMessage(reason));
    } finally {
      setLabSearchBusy(false);
    }
  };

  const addReport = () => {
    if (reportTitle.trim().length < 2 || reportLab.trim().length < 2 || !reportDate) return;
    onAddRecord({
      ...(patientId ? { patientId } : {}),
      title: reportTitle.trim(),
      category: "Lab report summary",
      source: reportLab.trim(),
      date: reportDate,
      summary: reportSummary.trim()
    });
    setReportTitle("");
    setReportLab("");
    setReportSummary("");
  };

  const addReading = () => {
    const value = Number(readingValue);
    if (measurement.trim().length < 2 || !Number.isFinite(value) || value < 0 || !readingUnit.trim() || !readingDate) return;
    onAddDevice({
      ...(patientId ? { patientId } : {}),
      device,
      measurement: measurement.trim(),
      value,
      unit: readingUnit.trim(),
      recordedAt: readingDate
    });
    setMeasurement("");
    setReadingValue("");
    setReadingUnit("");
  };

  return <section><SectionTitle eyebrow="YOUR HEALTH JOURNEY" title="Health records & results" action={<Badge appearance="tint" color="informative">Demo data only</Badge>} />
    <div className="nearby-search panel-card">
      <div><Text className="eyebrow">LABORATORIES NEAR YOU</Text><Title2>Find a nearby lab</Title2><Text className="subtle-text">Search OpenStreetMap for nearby laboratories. Contact the lab to confirm services and report availability.</Text></div>
      <Button appearance="secondary" icon={<Location24Regular />} onClick={() => void findLabs()} disabled={labSearchBusy}>{labSearchBusy ? "Finding labs…" : "Find nearby labs"}</Button>
      {labSearchStatus && <div className="nearby-status" role="status">{labSearchStatus}</div>}
      {labs.length > 0 && <div className="nearby-grid">{labs.map((lab) => {
        const phone = lab.tags?.phone ?? lab.tags?.["contact:phone"];
        const mapUrl = `https://www.openstreetmap.org/?mlat=${lab.latitude}&mlon=${lab.longitude}#map=17/${lab.latitude}/${lab.longitude}`;
        return <Card className="nearby-card" key={`${lab.type}-${lab.id}`}><Badge appearance="tint" color="success">Laboratory</Badge><Title2>{lab.name}</Title2><Text className="nearby-distance">{lab.distanceKm < 1 ? `${Math.round(lab.distanceKm * 1000)} m away` : `${lab.distanceKm.toFixed(1)} km away`}</Text>{phone && <a className="nearby-phone" href={`tel:${phone.replace(/[^\d+*#,;]/g, "")}`}>Call {phone}</a>}<a className="nearby-map" href={mapUrl} target="_blank" rel="noreferrer">View map</a></Card>;
      })}</div>}
    </div>
    <div className="content-columns records-tools">
      <Card className="panel-card"><div className="panel-heading"><div><Text className="eyebrow">SHARED WITH YOUR CARE TEAM</Text><Title2>Recent records & report summaries</Title2></div><ClipboardTask24Regular /></div>
        <div className="safety-strip compact"><span>ℹ</span><div><b>Summary metadata only</b><small>Do not enter real patient information in this demo. Secure report file uploads/downloads and lab integrations are not enabled.</small></div></div>
        {data.map((item) => <div className="record-row large-row" key={item.id}><span className="record-icon"><ClipboardTask24Regular /></span><span className="record-copy"><b>{item.title}</b><small>{item.category}{item.source ? ` · ${item.source}` : ""} · Added {formatDate(item.date)}</small>{item.summary && <small>{item.summary}</small>}</span><Badge appearance="outline">{item.fileAvailable ? "File available" : "Summary only"}</Badge></div>)}
        {!data.length && <EmptyState title="No records to display" detail={role === "patient" ? "Add a fictional report summary or ask your care team to share a summary." : "This profile has no shared records."} />}
      </Card>
      <div className="records-form-column">
        {canEnter && <Card className="form-card"><Text className="eyebrow">DEMO REPORT SUMMARY</Text><Title2>Add lab report details</Title2><label>Report title<Input value={reportTitle} onChange={(_, change) => setReportTitle(change.value)} /></label><label>Lab or source<Input value={reportLab} onChange={(_, change) => setReportLab(change.value)} /></label><label>Report date<Input type="date" value={reportDate} onChange={(_, change) => setReportDate(change.value)} /></label><label>Short summary (optional)<Textarea value={reportSummary} onChange={(_, change) => setReportSummary(change.value)} maxLength={500} /></label><Button appearance="primary" disabled={busy || reportTitle.trim().length < 2 || reportLab.trim().length < 2 || !reportDate} onClick={addReport}>Add demo summary</Button><small className="nearby-privacy">This saves only typed summary metadata in temporary demo memory, not a report file.</small></Card>}
      </div>
    </div>
    <div className="content-columns records-device-section">
      <Card className="panel-card"><div className="panel-heading"><div><Text className="eyebrow">MANUAL / DEMO ENTRIES</Text><Title2>Health device readings</Title2></div><HeartPulse24Regular /></div>
        <div className="safety-strip compact"><span>ℹ</span><div><b>No device is connected</b><small>Smartwatches, phones, glucose meters, and other devices are not synced. These are manually entered demo values and are not interpreted as medical advice.</small></div></div>
        {deviceReadings.map((item) => <div className="record-row large-row" key={item.id}><span className="record-icon"><HeartPulse24Regular /></span><span className="record-copy"><b>{item.measurement}: {item.value} {item.unit}</b><small>{item.device} · {formatDate(item.recordedAt)}</small></span><Badge appearance="outline">Manual</Badge></div>)}
        {!deviceReadings.length && <EmptyState title="No device readings" detail="Manually entered demo readings will appear here. No device has been connected." />}
      </Card>
      {canEnter && <Card className="form-card"><Text className="eyebrow">MANUAL DEMO ENTRY</Text><Title2>Add a device reading</Title2><label>Device<Select value={device} onChange={(_, option) => setDevice(option.value)}><option>Smartwatch</option><option>Phone health app</option><option>Blood glucose meter</option><option>Blood pressure monitor</option><option>Other healthcare device</option></Select></label><label>Measurement<Input value={measurement} onChange={(_, change) => setMeasurement(change.value)} placeholder="Enter device measurement label" /></label><div className="device-value-fields"><label>Value<Input type="number" min="0" step="any" value={readingValue} onChange={(_, change) => setReadingValue(change.value)} /></label><label>Unit<Input value={readingUnit} onChange={(_, change) => setReadingUnit(change.value)} /></label></div><label>Reading date<Input type="date" value={readingDate} onChange={(_, change) => setReadingDate(change.value)} /></label><Button appearance="primary" disabled={busy || measurement.trim().length < 2 || !readingValue || !Number.isFinite(Number(readingValue)) || Number(readingValue) < 0 || !readingUnit.trim() || !readingDate} onClick={addReading}>Save manual demo reading</Button></Card>}
    </div>
    <small className="nearby-attribution">Map data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a> (ODbL). Nearby lab listings and contacts can be incomplete or out of date.</small>
  </section>;
}

function Messages({ data, text, setText, busy, onSend }: { data: Message[]; text: string; setText: (value: string) => void; busy: boolean; onSend: () => void }) {
  const [mode, setMode] = useState<"assistant" | "team">("assistant");
  const [assistantText, setAssistantText] = useState("");
  const [assistantBusy, setAssistantBusy] = useState(false);
  const [assistantError, setAssistantError] = useState("");
  const [provider, setProvider] = useState("Checking assistant…");
  const [conversation, setConversation] = useState<{ role: "user" | "assistant"; content: string; provider?: string }[]>([
    { role: "assistant", content: "Hi, I’m Harbor’s health information assistant. I can help with general health information and preparing questions for your care team. I can’t diagnose conditions or recommend treatment." }
  ]);

  useEffect(() => {
    let active = true;
    api.assistantStatus().then((result) => {
      if (active) setProvider(result.provider);
    }).catch(() => {
      if (active) setProvider("Unavailable");
    });
    return () => { active = false; };
  }, []);

  const askAssistant = async (value: string) => {
    const message = value.trim();
    if (!message || assistantBusy) return;
    const nextConversation = [...conversation, { role: "user" as const, content: message }];
    setConversation(nextConversation);
    setAssistantText("");
    setAssistantError("");
    setAssistantBusy(true);
    try {
      const result = await api.askAssistant(
        message,
        nextConversation.slice(-8, -1).map(({ role, content }) => ({ role, content }))
      );
      setConversation([...nextConversation, { role: "assistant", content: result.reply, provider: result.provider }]);
    } catch (reason) {
      setAssistantError(reason instanceof Error ? reason.message : "The assistant could not respond. Please try again.");
    } finally {
      setAssistantBusy(false);
    }
  };

  return <section><SectionTitle eyebrow="A DIRECT LINE TO YOUR CARE TEAM" title="Messages" action={<Badge appearance="tint" color="informative">Not for urgent needs</Badge>} />
    <div className="chat-mode-switch" role="group" aria-label="Choose a conversation">
      <Button appearance={mode === "assistant" ? "primary" : "secondary"} onClick={() => setMode("assistant")}>AI health assistant</Button>
      <Button appearance={mode === "team" ? "primary" : "secondary"} onClick={() => setMode("team")}>Harbor Care Team</Button>
    </div>
    {mode === "assistant" ? <Card className="messages-card">
      <div className="conversation-head"><Avatar name="Harbor Health Assistant" color="brand" /><div><b>Harbor Health Assistant</b><small>General health information · {provider}</small></div><Badge appearance="tint" color={provider === "Azure OpenAI" ? "success" : "informative"}>{provider}</Badge></div>
      <div className="safety-strip assistant-safety"><span>!</span><div><b>Not for emergencies or medical decisions</b><small>Do not share your name, contact details, or private health information here. This assistant cannot diagnose or recommend medicines. For urgent symptoms, contact local emergency services.</small></div></div>
      <div className="conversation-body assistant-conversation" aria-live="polite">
        {conversation.map((item, index) => <div className={`bubble-row ${item.role === "user" ? "mine" : ""}`} key={`${index}-${item.role}`}><div className="bubble"><small>{item.role === "user" ? "You" : `Health assistant${item.provider ? ` · ${item.provider}` : ""}`}</small><p>{item.content}</p></div></div>)}
        {assistantBusy && <div className="assistant-pending"><Spinner size="tiny" /> Assistant is responding…</div>}
      </div>
      {assistantError && <div className="alert alert-error assistant-error" role="alert">{assistantError}</div>}
      {conversation.length === 1 && <div className="assistant-prompts"><span>Try asking:</span>{["How can I prepare for an appointment?", "What should I ask my pharmacist about a new medicine?", "Where can I find general information about fever?"].map((prompt) => <Button key={prompt} appearance="secondary" size="small" onClick={() => void askAssistant(prompt)} disabled={assistantBusy}>{prompt}</Button>)}</div>}
      <form className="composer" onSubmit={(event) => { event.preventDefault(); void askAssistant(assistantText); }}>
        <Textarea resize="vertical" value={assistantText} onChange={(_, change) => setAssistantText(change.value)} placeholder="Ask a general health question…" aria-label="Message to health assistant" maxLength={1000} />
        <Button appearance="primary" type="submit" disabled={!assistantText.trim() || assistantBusy}>Send</Button>
      </form>
      <div className="conversation-note">{provider === "Azure OpenAI" ? "AI replies can be wrong. Check important information with your care team or pharmacist. Messages are sent to the configured Azure OpenAI resource and are not stored by this app." : provider === "Scripted demo" ? "Scripted demo replies are not generated by an AI model. Configure Azure OpenAI to enable model-generated replies. This chat is not stored by the app." : "Assistant status is unavailable. Try again later or contact your care team. Do not share private health information here."}</div>
    </Card> : <Card className="messages-card">
      <div className="conversation-head"><Avatar name="Harbor Care Team" color="brand" /><div><b>Harbor Care Team</b><small>Usually replies within one business day</small></div><Badge appearance="tint" color="success">Care team</Badge></div>
      <div className="conversation-body">{data.map((item) => <div className={`bubble-row ${item.role === "patient" || item.role === "caregiver" ? "mine" : ""}`} key={item.id}><div className="bubble"><small>{item.from} · {formatDate(item.date)}</small><p>{item.text}</p></div></div>)}{!data.length && <EmptyState title="Start a conversation" detail="Send a non-urgent question to your care team." />}</div>
      <div className="composer"><Textarea resize="vertical" value={text} onChange={(_, change) => setText(change.value)} placeholder="Write a message to your care team…" aria-label="Message to care team" /><Button appearance="primary" disabled={!text.trim() || busy} onClick={onSend}>Send</Button></div>
      <div className="conversation-note">If you may be experiencing a medical emergency, contact local emergency services. This inbox is not monitored continuously.</div>
    </Card>}
  </section>;
}

function Community({
  data, role, mode, volunteerCode, donorName, donorPhone, donorBloodType, donorCountry, donorState, donorDistrict, donorCity,
  donorConsent, setDonorConsent, setDonorName, setDonorPhone, setDonorBloodType, setDonorCountry, setDonorState,
  setDonorDistrict, setDonorCity, requestBlood, requestUnits, requestUrgency, requestArea, setRequestBlood,
  setRequestUnits, setRequestUrgency, setRequestArea, busy, onSaveDonor, onRequestBlood
}: {
  data: DashboardData;
  role: Role;
  mode: string;
  volunteerCode?: string;
  donorName: string;
  donorPhone: string;
  donorBloodType: BloodGroup | "";
  donorCountry: string;
  donorState: string;
  donorDistrict: string;
  donorCity: string;
  donorConsent: boolean;
  setDonorConsent: (value: boolean) => void;
  setDonorName: (value: string) => void;
  setDonorPhone: (value: string) => void;
  setDonorBloodType: (value: BloodGroup | "") => void;
  setDonorCountry: (value: string) => void;
  setDonorState: (value: string) => void;
  setDonorDistrict: (value: string) => void;
  setDonorCity: (value: string) => void;
  requestBlood: BloodGroup;
  requestUnits: number;
  requestUrgency: "Routine" | "Urgent";
  requestArea: string;
  setRequestBlood: (value: BloodGroup) => void;
  setRequestUnits: (value: number) => void;
  setRequestUrgency: (value: "Routine" | "Urgent") => void;
  setRequestArea: (value: string) => void;
  busy: boolean;
  onSaveDonor: () => void;
  onRequestBlood: () => void;
}) {
  const isDonor = role === "donor";
  const isVolunteer = role === "volunteer";
  const canRequestBlood = ["patient", "volunteer", "clinician", "administrator"].includes(role);
  const matchedDonors = data.matches.filter((match) =>
    data.bloodRequests.some((request) =>
      request.bloodType === match.bloodType && (
        request.area.toLowerCase().includes(match.area.toLowerCase()) ||
        match.area.toLowerCase().includes(request.area.toLowerCase())
      )
    )
  );
  const availableRegions = countries.includes(donorCountry as (typeof countries)[number])
    ? regionsByCountry[donorCountry as (typeof countries)[number]]
    : [];
  const profileComplete = Boolean(donorCountry && donorState && donorDistrict.trim() && donorCity.trim());
  const phoneDigits = donorPhone.replace(/\D/g, "");
  const validPhone = /^\+?[0-9\s().-]+$/.test(donorPhone) && phoneDigits.length >= 7 && phoneDigits.length <= 15;
  return <section><SectionTitle eyebrow="COMMUNITY CARE" title="Blood donor network" action={<Badge appearance="tint" color="success">Private donor profiles · active requests</Badge>} />
    {isVolunteer && <Card className="volunteer-code-card"><div><Text className="eyebrow">YOUR VOLUNTEER REFERRAL CODE</Text><Title2>{volunteerCode ?? "Code unavailable"}</Title2><Text className="subtle-text">Share this code with volunteers you invite. It identifies the referral only; it does not grant account access.</Text></div></Card>}
    <div className="content-columns">
      {isDonor ? <div className="donor-form-column">
        <Card className="form-card"><Text className="eyebrow">YOUR PRIVATE PROFILE</Text><Title2>Donor details</Title2><Text className="subtle-text">{mode === "production" ? "Your contact number is encrypted before it is stored in PostgreSQL and is returned only to your signed-in account. It is never shown on the public request list." : mode === "local" ? "Your phone number is encrypted before being saved in this computer's local database and is returned only to your signed-in account. It is never shown on the public request list." : "This sample environment stores data only in memory. Do not enter real personal data."}</Text>
          <label>Donor Name<Input autoComplete="name" maxLength={100} value={donorName} onChange={(_, change) => setDonorName(change.value)} required /></label>
          <label>Phone Number<Input type="tel" autoComplete="tel" inputMode="tel" maxLength={25} placeholder="+91 98765 43210" value={donorPhone} onChange={(_, change) => setDonorPhone(change.value)} required /></label>
          {donorPhone && !validPhone && <Text className="field-error" role="alert">Enter a valid phone number with 7–15 digits.</Text>}
          <label className="consent-label"><input type="checkbox" checked={donorConsent} onChange={(event) => setDonorConsent(event.currentTarget.checked)} /><span>I consent to storing my donor name, phone, blood group, and location in my private account profile so I can manage my donor registration. My phone number will not be public.</span></label>
          <Text className="eyebrow donor-guidance-title">DONOR GUIDANCE</Text>
          <div className="donor-guidance"><b>Check eligibility with your blood bank</b><span>Eligibility and donation timing depend on your health and local rules. Be honest about your health and medicines, and ask trained blood-bank staff to confirm whether it is safe for you to donate. Do not rely on this demo for medical eligibility decisions.</span><div><a href="https://www.friends2support.org/inner/about/whocandonate.aspx" target="_blank" rel="noreferrer">Who can donate? · Friends2Support</a><a href="https://www.friends2support.org/inner/about/blood.aspx" target="_blank" rel="noreferrer">Blood donation facts · Friends2Support</a></div></div>
          <Text className="subtle-text">Choose your blood group and location. District and city suggestions are optional; you can type a location that is not listed.</Text>
          <label>Blood Group<Select value={donorBloodType} onChange={(_, option) => setDonorBloodType(option.value as BloodGroup | "")}><option value="">-----Select-----</option>{donorBloodGroups.map((item) => <option value={item} key={item}>{item}</option>)}</Select></label>
          <label>Select Country<Select value={donorCountry} onChange={(_, option) => setDonorCountry(option.value)}><option value="">-----Select-----</option>{countries.map((country) => <option value={country} key={country}>{country}</option>)}</Select></label>
          <label>Select State<Select value={donorState} disabled={!donorCountry} onChange={(_, option) => setDonorState(option.value)}><option value="">-----Select-----</option>{availableRegions.map((region) => <option value={region} key={region}>{region}</option>)}</Select></label>
          <label>Select District<Input list="donor-district-suggestions" placeholder="Select District or enter one" value={donorDistrict} disabled={!donorState} onChange={(_, change) => setDonorDistrict(change.value)} /></label>
          <datalist id="donor-district-suggestions">{(districtSuggestionsByCountry[donorCountry as (typeof countries)[number]] ?? []).map((district) => <option value={district} key={district} />)}</datalist>
          <label>Select City<Input list="donor-city-suggestions" placeholder="Select City or enter one" value={donorCity} disabled={!donorState} onChange={(_, change) => setDonorCity(change.value)} /></label>
          <datalist id="donor-city-suggestions">{(citySuggestionsByCountry[donorCountry as (typeof countries)[number]] ?? []).map((city) => <option value={city} key={city} />)}</datalist>
          <Button appearance="primary" disabled={busy || !donorConsent || !profileComplete || !donorBloodType || donorName.trim().length < 2 || !validPhone} onClick={onSaveDonor}>Save donor profile</Button>
        </Card>
      </div> :
        canRequestBlood && <Card className="form-card"><Text className="eyebrow">BLOOD REQUEST</Text><Title2>Post a request</Title2><Text className="subtle-text">Only blood group, broad area and unit count appear in the active request list. Do not enter patient names or phone numbers. A qualified blood bank must confirm compatibility.</Text><label>Blood type needed<Select value={requestBlood} onChange={(_, option) => setRequestBlood(option.value as BloodGroup)}>{donorBloodGroups.map((item) => <option value={item} key={item}>{item}</option>)}</Select></label><label>General area<Input value={requestArea} onChange={(_, change) => setRequestArea(change.value)} placeholder="City, district, or broad area" /></label><label>Units needed<Input type="number" min="1" max="20" step="1" value={String(requestUnits)} onChange={(_, change) => setRequestUnits(Number(change.value))} /></label><label>Urgency<Select value={requestUrgency} onChange={(_, option) => setRequestUrgency(option.value as "Routine" | "Urgent")}><option value="Routine">Routine</option><option value="Urgent">Urgent</option></Select></label><Button appearance="primary" disabled={busy || requestArea.trim().length < 2 || requestUnits < 1 || requestUnits > 20} onClick={onRequestBlood}>{mode === "production" || mode === "local" ? "Save active request" : "Add demo request"}</Button></Card>}
      <Card className="panel-card"><div className="panel-heading"><div><Text className="eyebrow">COMMUNITY NETWORK</Text><Title2>Active requests</Title2></div><People24Regular /></div>{data.bloodRequests.map((item) => <div className="request-row" key={item.id}><span className="blood-type">{item.bloodType}</span><div className="record-copy"><b>{item.units} {item.units === 1 ? "unit" : "units"} needed · {item.area}</b><small>{item.clinic} · {item.status ?? "active"}</small></div><Badge appearance="tint" color={item.urgency === "Urgent" ? "danger" : "informative"}>{item.urgency}</Badge></div>)}{!data.bloodRequests.length && <EmptyState title="No active requests" detail="New requests will appear here." />}
      {matchedDonors.length > 0 && <div className="match-box"><b>Potential matches in sample data</b>{matchedDonors.map((match) => <small key={match.donorId}>{match.bloodType} · {match.area}</small>)}<small>Matched by blood type and broad area. Only minimum details are displayed.</small></div>}
      </Card>
    </div>
  </section>;
}

function Catalog({ data, selected, setSelected, busy, onCheckout }: { data: CatalogItem[]; selected: string; setSelected: (id: string) => void; busy: boolean; onCheckout: () => void }) {
  const [medicineSearch, setMedicineSearch] = useState("");
  const [pharmacies, setPharmacies] = useState<NearbyFacility[]>([]);
  const [pharmacySearchStatus, setPharmacySearchStatus] = useState("");
  const [searchingPharmacies, setSearchingPharmacies] = useState(false);
  const searchPharmacies = async () => {
    if (medicineSearch.trim().length < 2) return;
    setSearchingPharmacies(true);
    setPharmacySearchStatus("");
    try {
      const { latitude, longitude } = await getCurrentLocation();
      const found = (await findNearbyFacilities(latitude, longitude)).filter((item) => item.category === "pharmacy");
      setPharmacies(found);
      setPharmacySearchStatus(found.length
        ? `Nearby pharmacies for “${medicineSearch.trim()}”. Stock is not verified; call to check availability.`
        : "No pharmacies were listed nearby. OpenStreetMap coverage may be incomplete.");
    } catch (reason) {
      setPharmacySearchStatus(locationErrorMessage(reason));
    } finally {
      setSearchingPharmacies(false);
    }
  };
  return <section><SectionTitle eyebrow="MEDICINE & WELLNESS" title="Medicine & wellness catalog" action={<Badge appearance="tint" color="warning">DEMO CHECKOUT · NO PAYMENTS</Badge>} />
    <div className="catalog-banner"><span>ⓘ</span><div><b>Fictional medicine listings · not treatment recommendations</b><small>Ask your clinician or pharmacist about medicines for you. Checkout is a demonstration: no order is placed, no payment is processed, and no goods are shipped.</small></div></div>
    <Card className="panel-card pharmacy-search">
      <div><Text className="eyebrow">NEARBY PHARMACIES</Text><Title2>Search for a medicine near you</Title2><Text className="subtle-text">Enter a medicine name, then find nearby pharmacies. The map directory does not show stock or confirm that a pharmacy sells it.</Text></div>
      <div className="pharmacy-search-controls"><Input aria-label="Medicine name to search" placeholder="Enter medicine name" value={medicineSearch} onChange={(_, change) => setMedicineSearch(change.value)} /><Button appearance="primary" icon={<Location24Regular />} onClick={() => void searchPharmacies()} disabled={searchingPharmacies || medicineSearch.trim().length < 2}>{searchingPharmacies ? "Searching…" : "Find nearby pharmacies"}</Button></div>
      <small className="nearby-privacy">Location is requested only when searching. Your coordinates are sent to OpenStreetMap; this app does not save them. No purchase or payment is available.</small>
      {pharmacySearchStatus && <div className="nearby-status" role="status">{pharmacySearchStatus}</div>}
      {pharmacies.length > 0 && <div className="nearby-grid">{pharmacies.map((pharmacy) => {
        const phone = pharmacy.tags?.phone ?? pharmacy.tags?.["contact:phone"];
        const mapUrl = `https://www.openstreetmap.org/?mlat=${pharmacy.latitude}&mlon=${pharmacy.longitude}#map=17/${pharmacy.latitude}/${pharmacy.longitude}`;
        return <Card className="nearby-card" key={`${pharmacy.type}-${pharmacy.id}`}><Badge appearance="tint" color="success">Pharmacy</Badge><Title2>{pharmacy.name}</Title2><Text className="nearby-distance">{pharmacy.distanceKm < 1 ? `${Math.round(pharmacy.distanceKm * 1000)} m away` : `${pharmacy.distanceKm.toFixed(1)} km away`}</Text>{phone && <a className="nearby-phone" href={`tel:${phone.replace(/[^\d+*#,;]/g, "")}`}>Call {phone}</a>}<a className="nearby-map" href={mapUrl} target="_blank" rel="noreferrer">View map</a></Card>;
      })}</div>}
    </Card>
    <div className="catalog-grid">{data.map((item, index) => <Card className="product-card" key={item.id}><div className={`product-art art-${index + 1}`}><ShoppingBag24Regular /></div><Badge appearance="tint" color="informative">Wellness</Badge><Title2>{item.name}</Title2><Text className="subtle-text">{item.detail}</Text><div className="product-bottom"><b>{item.priceLabel}</b><Button appearance={selected === item.id ? "primary" : "secondary"} onClick={() => setSelected(item.id)} disabled={busy}>{selected === item.id ? "Selected" : "Select item"}</Button></div></Card>)}</div>
    {selected && <div className="checkout-row"><Text className="subtle-text">Selected item: {data.find((item) => item.id === selected)?.name}. This action will not create an order or collect payment.</Text><Button appearance="primary" onClick={onCheckout} disabled={busy}>{busy ? "Completing demo…" : "Complete demo checkout"}</Button></div>}
  </section>;
}

function Education({ data }: { data: EducationItem[] }) {
  return <section><SectionTitle eyebrow="LEARN & FEEL PREPARED" title="Health education" action={<Badge appearance="tint" color="informative">General education only</Badge>} />
    <div className="education-intro"><span className="education-symbol"><HeartPulse24Regular /></span><div><b>Supportive information, not a diagnosis.</b><small>These educational materials are sample content. They do not assess symptoms, recommend treatment, or replace advice from a qualified clinician.</small></div></div>
    <div className="education-grid">{data.map((item) => <Card className="education-card" key={item.id}><Badge appearance="tint" color={item.reviewStatus === "clinician-reviewed" ? "success" : "informative"}>{item.reviewStatus === "clinician-reviewed" ? "Clinician-reviewed" : "Sample · review required"}</Badge><Title2>{item.title}</Title2><Text>{item.summary}</Text><div className="review-meta"><ShieldCheckmark24Regular /><span>{item.reviewedBy ?? "Not clinically reviewed"}<br />{item.updated}</span></div></Card>)}</div>
    <div className="urgent-card"><span className="urgent-icon">!</span><div><b>When to seek immediate help</b><small>For severe difficulty breathing, loss of consciousness, uncontrolled bleeding, or another immediate emergency, contact your local emergency services now. This site is not monitored for emergencies.</small></div></div>
  </section>;
}

function Administration({ users }: { users: User[] }) {
  return <section><SectionTitle eyebrow="CLINIC OPERATIONS" title="Administration" action={<Badge appearance="tint" color="warning">Demo clinic data</Badge>} />
    <Card className="panel-card"><div className="panel-heading"><div><Text className="eyebrow">HARBOR COMMUNITY CLINIC</Text><Title2>Demo users & roles</Title2></div><ShieldCheckmark24Regular /></div>
      <div className="safety-strip compact"><span>ℹ</span><div><b>Access is role-limited in this demo</b><small>Production identity, consent, audit, retention, and clinic-scoping controls require implementation and review.</small></div></div>
      {users.map((item) => <div className="user-row" key={item.id}><Avatar name={item.name} initials={item.initials} color="colorful" /><div className="record-copy"><b>{item.name}</b><small>{item.clinic}</small></div><Badge appearance="outline">{roleLabel[item.role]}</Badge></div>)}
    </Card>
  </section>;
}

export default App;
