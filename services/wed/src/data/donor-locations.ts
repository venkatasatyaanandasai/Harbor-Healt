import type { BloodGroup } from "@health/shared";

export const donorBloodGroups: BloodGroup[] = [
  "A+", "A-", "A1+", "A1-", "A1B+", "A1B-", "A2+", "A2-", "A2B+", "A2B-",
  "AB+", "AB-", "B+", "B-", "Bombay Blood Group", "INRA", "O+", "O-"
];

export const countries = [
  "INDIA",
  "YEMEN-اليمن",
  "NEPAL",
  "SRI LANKA",
  "BANGLADESH",
  "MALAYSIA",
  "OMAN"
] as const;

export const regionsByCountry: Record<(typeof countries)[number], string[]> = {
  INDIA: [
    "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat",
    "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh",
    "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab",
    "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh",
    "Uttarakhand", "West Bengal", "Andaman and Nicobar Islands", "Chandigarh",
    "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Jammu and Kashmir", "Ladakh",
    "Lakshadweep", "Puducherry"
  ],
  "YEMEN-اليمن": [
    "Abyan", "Aden", "Al Bayda", "Al Dhale'e", "Al Hudaydah", "Al Jawf", "Al Mahrah",
    "Al Mahwit", "Amran", "Dhamar", "Hadhramaut", "Hajjah", "Ibb", "Lahij", "Ma'rib",
    "Raymah", "Saada", "Sana'a", "Sana'a City", "Shabwah", "Socotra", "Taiz"
  ],
  NEPAL: [
    "Koshi Province", "Madhesh Province", "Bagmati Province", "Gandaki Province",
    "Lumbini Province", "Karnali Province", "Sudurpashchim Province"
  ],
  "SRI LANKA": [
    "Central", "Eastern", "North Central", "Northern", "North Western", "Sabaragamuwa",
    "Southern", "Uva", "Western"
  ],
  BANGLADESH: [
    "Barishal", "Chattogram", "Dhaka", "Khulna", "Mymensingh", "Rajshahi", "Rangpur", "Sylhet"
  ],
  MALAYSIA: [
    "Johor", "Kedah", "Kelantan", "Melaka", "Negeri Sembilan", "Pahang", "Penang", "Perak",
    "Perlis", "Sabah", "Sarawak", "Selangor", "Terengganu", "Kuala Lumpur", "Labuan", "Putrajaya"
  ],
  OMAN: [
    "Ad Dakhiliyah", "Ad Dhahirah", "Al Batinah North", "Al Batinah South", "Al Buraimi",
    "Al Wusta", "Ash Sharqiyah North", "Ash Sharqiyah South", "Dhofar", "Musandam", "Muscat"
  ]
};

export const districtSuggestionsByCountry: Record<(typeof countries)[number], string[]> = {
  INDIA: ["Bengaluru Urban", "Mumbai Suburban", "Chennai", "Hyderabad", "Kolkata", "Pune", "Jaipur", "Lucknow", "Ernakulam", "Ahmedabad"],
  "YEMEN-اليمن": ["Aden", "Sana'a", "Taiz", "Al Hudaydah", "Hadhramaut", "Ibb"],
  NEPAL: ["Kathmandu", "Lalitpur", "Bhaktapur", "Kaski", "Morang", "Chitwan"],
  "SRI LANKA": ["Colombo", "Gampaha", "Kandy", "Galle", "Jaffna", "Matara"],
  BANGLADESH: ["Dhaka", "Chattogram", "Cumilla", "Sylhet", "Khulna", "Rajshahi"],
  MALAYSIA: ["Johor Bahru", "Kota Kinabalu", "Kuching", "Petaling", "Klang", "Kuala Lumpur"],
  OMAN: ["Muscat", "Salalah", "Sohar", "Nizwa", "Sur", "Buraimi"]
};

export const citySuggestionsByCountry: Record<(typeof countries)[number], string[]> = {
  INDIA: ["New Delhi", "Mumbai", "Bengaluru", "Chennai", "Hyderabad", "Kolkata", "Pune", "Jaipur"],
  "YEMEN-اليمن": ["Aden", "Sana'a", "Taiz", "Al Hudaydah", "Mukalla", "Ibb"],
  NEPAL: ["Kathmandu", "Lalitpur", "Pokhara", "Biratnagar", "Bharatpur", "Janakpur"],
  "SRI LANKA": ["Colombo", "Kandy", "Galle", "Jaffna", "Negombo", "Matara"],
  BANGLADESH: ["Dhaka", "Chattogram", "Khulna", "Rajshahi", "Sylhet", "Rangpur"],
  MALAYSIA: ["Kuala Lumpur", "George Town", "Johor Bahru", "Kota Kinabalu", "Kuching", "Ipoh"],
  OMAN: ["Muscat", "Salalah", "Sohar", "Nizwa", "Sur", "Buraimi"]
};
