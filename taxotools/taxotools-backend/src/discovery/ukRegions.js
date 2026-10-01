/**
 * UK city grid (~40–60 mile spacing) for regional "accountants near …" discovery.
 * Covers England, Scotland, Wales, Northern Ireland.
 */
export const UK_REGION_GRID = [
  // London & South East
  { name: "London", region: "Greater London", lat: 51.5074, lng: -0.1278 },
  { name: "Croydon", region: "Greater London", lat: 51.3762, lng: -0.0982 },
  { name: "Romford", region: "Greater London", lat: 51.5819, lng: 0.1837 },
  { name: "Watford", region: "Hertfordshire", lat: 51.6565, lng: -0.3903 },
  { name: "Reading", region: "Berkshire", lat: 51.4543, lng: -0.9781 },
  { name: "Slough", region: "Berkshire", lat: 51.5105, lng: -0.595 },
  { name: "Guildford", region: "Surrey", lat: 51.2362, lng: -0.5704 },
  { name: "Brighton", region: "East Sussex", lat: 50.8225, lng: -0.1372 },
  { name: "Eastbourne", region: "East Sussex", lat: 50.768, lng: 0.2905 },
  { name: "Hastings", region: "East Sussex", lat: 50.8543, lng: 0.5735 },
  { name: "Maidstone", region: "Kent", lat: 51.2704, lng: 0.5227 },
  { name: "Canterbury", region: "Kent", lat: 51.2802, lng: 1.0789 },
  { name: "Dover", region: "Kent", lat: 51.1279, lng: 1.3134 },
  { name: "Oxford", region: "Oxfordshire", lat: 51.752, lng: -1.2577 },
  { name: "Milton Keynes", region: "Buckinghamshire", lat: 52.0406, lng: -0.7594 },
  { name: "Luton", region: "Bedfordshire", lat: 51.8787, lng: -0.42 },
  { name: "Cambridge", region: "Cambridgeshire", lat: 52.2053, lng: 0.1218 },
  { name: "Colchester", region: "Essex", lat: 51.8959, lng: 0.8919 },
  { name: "Southend-on-Sea", region: "Essex", lat: 51.5459, lng: 0.7077 },
  { name: "Ipswich", region: "Suffolk", lat: 52.0567, lng: 1.1482 },
  { name: "Norwich", region: "Norfolk", lat: 52.6309, lng: 1.2974 },
  { name: "Peterborough", region: "Cambridgeshire", lat: 52.5695, lng: -0.2405 },
  { name: "Southampton", region: "Hampshire", lat: 50.9097, lng: -1.4044 },
  { name: "Portsmouth", region: "Hampshire", lat: 50.8198, lng: -1.088 },
  { name: "Bournemouth", region: "Dorset", lat: 50.7192, lng: -1.8808 },
  { name: "Winchester", region: "Hampshire", lat: 51.0632, lng: -1.308 },

  // South West
  { name: "Bristol", region: "Bristol", lat: 51.4545, lng: -2.5879 },
  { name: "Bath", region: "Somerset", lat: 51.3811, lng: -2.359 },
  { name: "Swindon", region: "Wiltshire", lat: 51.5558, lng: -1.7797 },
  { name: "Gloucester", region: "Gloucestershire", lat: 51.8642, lng: -2.2382 },
  { name: "Cheltenham", region: "Gloucestershire", lat: 51.8994, lng: -2.0783 },
  { name: "Exeter", region: "Devon", lat: 50.7184, lng: -3.5339 },
  { name: "Plymouth", region: "Devon", lat: 50.3755, lng: -4.1427 },
  { name: "Torquay", region: "Devon", lat: 50.4619, lng: -3.5253 },
  { name: "Truro", region: "Cornwall", lat: 50.2632, lng: -5.051 },
  { name: "Taunton", region: "Somerset", lat: 51.015, lng: -3.103 },
  { name: "Yeovil", region: "Somerset", lat: 50.942, lng: -2.633 },

  // Midlands
  { name: "Birmingham", region: "West Midlands", lat: 52.4862, lng: -1.8904 },
  { name: "Coventry", region: "West Midlands", lat: 52.4068, lng: -1.5197 },
  { name: "Wolverhampton", region: "West Midlands", lat: 52.5862, lng: -2.1288 },
  { name: "Stoke-on-Trent", region: "Staffordshire", lat: 53.0027, lng: -2.1794 },
  { name: "Derby", region: "Derbyshire", lat: 52.9225, lng: -1.4746 },
  { name: "Nottingham", region: "Nottinghamshire", lat: 52.9548, lng: -1.1581 },
  { name: "Leicester", region: "Leicestershire", lat: 52.6369, lng: -1.1398 },
  { name: "Northampton", region: "Northamptonshire", lat: 52.2405, lng: -0.9027 },
  { name: "Lincoln", region: "Lincolnshire", lat: 53.2307, lng: -0.5406 },
  { name: "Worcester", region: "Worcestershire", lat: 52.1936, lng: -2.2215 },
  { name: "Shrewsbury", region: "Shropshire", lat: 52.7073, lng: -2.7553 },
  { name: "Hereford", region: "Herefordshire", lat: 52.0565, lng: -2.716 },

  // North West
  { name: "Manchester", region: "Greater Manchester", lat: 53.4808, lng: -2.2426 },
  { name: "Bolton", region: "Greater Manchester", lat: 53.5765, lng: -2.4282 },
  { name: "Oldham", region: "Greater Manchester", lat: 53.5409, lng: -2.1114 },
  { name: "Stockport", region: "Greater Manchester", lat: 53.4106, lng: -2.1575 },
  { name: "Liverpool", region: "Merseyside", lat: 53.4084, lng: -2.9916 },
  { name: "Preston", region: "Lancashire", lat: 53.7632, lng: -2.7031 },
  { name: "Blackpool", region: "Lancashire", lat: 53.8175, lng: -3.0357 },
  { name: "Lancaster", region: "Lancashire", lat: 54.0466, lng: -2.8007 },
  { name: "Chester", region: "Cheshire", lat: 53.1934, lng: -2.8931 },
  { name: "Warrington", region: "Cheshire", lat: 53.390044, lng: -2.59695 },
  { name: "Carlisle", region: "Cumbria", lat: 54.8951, lng: -2.9382 },

  // Yorkshire & North East
  { name: "Leeds", region: "West Yorkshire", lat: 53.8008, lng: -1.5491 },
  { name: "Bradford", region: "West Yorkshire", lat: 53.796, lng: -1.7594 },
  { name: "Huddersfield", region: "West Yorkshire", lat: 53.6458, lng: -1.785 },
  { name: "Sheffield", region: "South Yorkshire", lat: 53.3811, lng: -1.4701 },
  { name: "Doncaster", region: "South Yorkshire", lat: 53.5228, lng: -1.1285 },
  { name: "York", region: "North Yorkshire", lat: 53.96, lng: -1.0873 },
  { name: "Hull", region: "East Yorkshire", lat: 53.7676, lng: -0.3274 },
  { name: "Middlesbrough", region: "Teesside", lat: 54.5742, lng: -1.2349 },
  { name: "Newcastle", region: "Tyne and Wear", lat: 54.9783, lng: -1.6178 },
  { name: "Sunderland", region: "Tyne and Wear", lat: 54.9069, lng: -1.3838 },
  { name: "Durham", region: "County Durham", lat: 54.7753, lng: -1.5849 },
  { name: "Darlington", region: "County Durham", lat: 54.5236, lng: -1.5528 },

  // Wales
  { name: "Cardiff", region: "Wales", lat: 51.4816, lng: -3.1791 },
  { name: "Swansea", region: "Wales", lat: 51.6214, lng: -3.9436 },
  { name: "Newport", region: "Wales", lat: 51.5842, lng: -2.9977 },
  { name: "Wrexham", region: "Wales", lat: 53.043, lng: -2.9925 },
  { name: "Bangor", region: "Wales", lat: 53.2274, lng: -4.1293 },
  { name: "Aberystwyth", region: "Wales", lat: 52.4153, lng: -4.0829 },

  // Scotland
  { name: "Glasgow", region: "Scotland", lat: 55.8642, lng: -4.2518 },
  { name: "Edinburgh", region: "Scotland", lat: 55.9533, lng: -3.1883 },
  { name: "Aberdeen", region: "Scotland", lat: 57.1497, lng: -2.0943 },
  { name: "Dundee", region: "Scotland", lat: 56.462, lng: -2.9707 },
  { name: "Inverness", region: "Scotland", lat: 57.4778, lng: -4.2247 },
  { name: "Perth", region: "Scotland", lat: 56.395, lng: -3.4308 },
  { name: "Stirling", region: "Scotland", lat: 56.1165, lng: -3.9369 },
  { name: "Ayr", region: "Scotland", lat: 55.4586, lng: -4.6292 },
  { name: "Dumfries", region: "Scotland", lat: 55.0701, lng: -3.6053 },
  { name: "Fort William", region: "Scotland", lat: 56.8198, lng: -5.1052 },

  // Northern Ireland
  { name: "Belfast", region: "Northern Ireland", lat: 54.5973, lng: -5.9301 },
  { name: "Derry", region: "Northern Ireland", lat: 54.9966, lng: -7.3086 },
  { name: "Lisburn", region: "Northern Ireland", lat: 54.5162, lng: -6.058 },
  { name: "Newry", region: "Northern Ireland", lat: 54.1751, lng: -6.3402 },
  { name: "Bangor NI", region: "Northern Ireland", lat: 54.663, lng: -5.668 },
];

export const REGIONAL_QUERIES = [
  "accountants near me",
  "accountant",
  "chartered accountant",
  "tax accountant",
  "bookkeeper",
  "accountancy firm",
];
