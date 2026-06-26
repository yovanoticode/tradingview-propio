export interface HeatmapItem {
  symbol: string;
  name: string;
  sector: string;
  weight: number;
}

export const NASDAQ_100: HeatmapItem[] = [
  // Technology
  { symbol: "AAPL", name: "Apple", sector: "Technology", weight: 3000 },
  { symbol: "MSFT", name: "Microsoft", sector: "Technology", weight: 3000 },
  { symbol: "NVDA", name: "NVIDIA", sector: "Technology", weight: 2800 },
  { symbol: "AVGO", name: "Broadcom", sector: "Technology", weight: 600 },
  { symbol: "ORCL", name: "Oracle", sector: "Technology", weight: 300 },
  { symbol: "CSCO", name: "Cisco", sector: "Technology", weight: 200 },
  { symbol: "ADBE", name: "Adobe", sector: "Technology", weight: 250 },
  { symbol: "CRM", name: "Salesforce", sector: "Technology", weight: 250 },
  { symbol: "AMD", name: "AMD", sector: "Technology", weight: 250 },
  { symbol: "INTC", name: "Intel", sector: "Technology", weight: 150 },
  { symbol: "QCOM", name: "Qualcomm", sector: "Technology", weight: 180 },
  { symbol: "TXN", name: "Texas Instruments", sector: "Technology", weight: 150 },
  { symbol: "AMAT", name: "Applied Materials", sector: "Technology", weight: 150 },
  { symbol: "MU", name: "Micron", sector: "Technology", weight: 120 },
  { symbol: "LRCX", name: "Lam Research", sector: "Technology", weight: 100 },
  { symbol: "KLAC", name: "KLA Corp", sector: "Technology", weight: 80 },
  { symbol: "SNPS", name: "Synopsys", sector: "Technology", weight: 80 },
  { symbol: "CDNS", name: "Cadence Design", sector: "Technology", weight: 80 },
  { symbol: "PANW", name: "Palo Alto Networks", sector: "Technology", weight: 80 },
  { symbol: "FTNT", name: "Fortinet", sector: "Technology", weight: 50 },
  { symbol: "CRWD", name: "CrowdStrike", sector: "Technology", weight: 70 },
  
  // Communication Services
  { symbol: "GOOGL", name: "Alphabet (Class A)", sector: "Communication Services", weight: 2000 },
  { symbol: "GOOG", name: "Alphabet (Class C)", sector: "Communication Services", weight: 2000 },
  { symbol: "META", name: "Meta Platforms", sector: "Communication Services", weight: 1200 },
  { symbol: "NFLX", name: "Netflix", sector: "Communication Services", weight: 250 },
  { symbol: "CMCSA", name: "Comcast", sector: "Communication Services", weight: 180 },
  { symbol: "TMUS", name: "T-Mobile", sector: "Communication Services", weight: 180 },
  { symbol: "CHTR", name: "Charter Comm", sector: "Communication Services", weight: 50 },
  { symbol: "EA", name: "Electronic Arts", sector: "Communication Services", weight: 40 },
  { symbol: "TTWO", name: "Take-Two", sector: "Communication Services", weight: 30 },

  // Consumer Cyclical
  { symbol: "AMZN", name: "Amazon", sector: "Consumer Cyclical", weight: 1800 },
  { symbol: "TSLA", name: "Tesla", sector: "Consumer Cyclical", weight: 600 },
  { symbol: "SBUX", name: "Starbucks", sector: "Consumer Cyclical", weight: 100 },
  { symbol: "BKNG", name: "Booking Holdings", sector: "Consumer Cyclical", weight: 120 },
  { symbol: "MAR", name: "Marriott", sector: "Consumer Cyclical", weight: 70 },
  { symbol: "LULU", name: "Lululemon", sector: "Consumer Cyclical", weight: 50 },
  { symbol: "ROST", name: "Ross Stores", sector: "Consumer Cyclical", weight: 50 },
  { symbol: "EBAY", name: "eBay", sector: "Consumer Cyclical", weight: 30 },
  
  // Consumer Defensive
  { symbol: "COST", name: "Costco", sector: "Consumer Defensive", weight: 300 },
  { symbol: "PEP", name: "PepsiCo", sector: "Consumer Defensive", weight: 250 },
  { symbol: "MDLZ", name: "Mondelez", sector: "Consumer Defensive", weight: 100 },
  { symbol: "KDP", name: "Keurig Dr Pepper", sector: "Consumer Defensive", weight: 50 },
  { symbol: "MNST", name: "Monster Beverage", sector: "Consumer Defensive", weight: 60 },
  { symbol: "KHC", name: "Kraft Heinz", sector: "Consumer Defensive", weight: 40 },

  // Healthcare
  { symbol: "AMGN", name: "Amgen", sector: "Healthcare", weight: 150 },
  { symbol: "ISRG", name: "Intuitive Surgical", sector: "Healthcare", weight: 140 },
  { symbol: "VRTX", name: "Vertex", sector: "Healthcare", weight: 120 },
  { symbol: "REGN", name: "Regeneron", sector: "Healthcare", weight: 100 },
  { symbol: "GILD", name: "Gilead Sciences", sector: "Healthcare", weight: 100 },
  { symbol: "ILMN", name: "Illumina", sector: "Healthcare", weight: 30 },
  { symbol: "BIIB", name: "Biogen", sector: "Healthcare", weight: 30 },
  { symbol: "IDXX", name: "IDEXX Labs", sector: "Healthcare", weight: 40 },
  { symbol: "DXCM", name: "DexCom", sector: "Healthcare", weight: 50 },
  { symbol: "ALGN", name: "Align Technology", sector: "Healthcare", weight: 25 },

  // Industrials
  { symbol: "HON", name: "Honeywell", sector: "Industrials", weight: 130 },
  { symbol: "ADP", name: "Automatic Data Proc.", sector: "Industrials", weight: 100 },
  { symbol: "CSX", name: "CSX Corp", sector: "Industrials", weight: 70 },
  { symbol: "PCAR", name: "PACCAR", sector: "Industrials", weight: 60 },
  { symbol: "CPRT", name: "Copart", sector: "Industrials", weight: 50 },
  { symbol: "FAST", name: "Fastenal", sector: "Industrials", weight: 40 },
  { symbol: "ODFL", name: "Old Dominion Freight", sector: "Industrials", weight: 40 },

  // Utilities / Real Estate / Other
  { symbol: "AEP", name: "American Electric", sector: "Utilities", weight: 45 },
  { symbol: "EXC", name: "Exelon", sector: "Utilities", weight: 35 },
  { symbol: "XEL", name: "Xcel Energy", sector: "Utilities", weight: 30 },
];
