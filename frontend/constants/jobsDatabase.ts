/**
 * Jobs Database — 60 curated O*NET SOC occupations mapped to COCA subgenres.
 *
 * Source: U.S. Bureau of Labor Statistics / Department of Labor,
 *   O*NET-SOC 2019 taxonomy (https://www.onetcenter.org/database.html).
 *   Standard Occupational Classification codes (SOC 2018) referenced for
 *   academic traceability and crosswalk to ISCO-08 (International Labour
 *   Organization).
 *
 * Each job maps to:
 *   - essential[] — COCA subgenres the learner MUST master to operate
 *                   effectively in that profession (3–5 codes).
 *   - important[] — high-value but secondary genres (2–4 codes).
 *
 * Mapping rationale: based on Biber & Conrad (2019) "Register, Genre, Style"
 *   methodology — registers cluster around shared lexico-grammatical features
 *   that align with professional discourse communities (Swales 1990).
 */

import type { CocaMainKey } from './cocaSubgenres';

export type Industry =
  | 'tech'
  | 'healthcare'
  | 'finance'
  | 'law_government'
  | 'education'
  | 'engineering'
  | 'media'
  | 'business'
  | 'creative'
  | 'science'
  | 'sales_marketing'
  | 'hospitality';

export interface IndustryMeta {
  key: Industry;
  label: string;
  icon: string;
  color: string;
  description: string;
}

export const INDUSTRIES: IndustryMeta[] = [
  { key: 'tech',             label: 'Technology',            icon: 'monitor', color: '#7C6FFF', description: 'Software, IT, data, AI' },
  { key: 'healthcare',       label: 'Healthcare',            icon: 'activity', color: '#EC4899', description: 'Medicine, nursing, therapy' },
  { key: 'finance',          label: 'Finance',               icon: 'dollar-sign', color: '#10B981', description: 'Banking, investment, accounting' },
  { key: 'law_government',   label: 'Law & Government',      icon: 'message-square', color: '#6366F1', description: 'Legal, policy, public sector' },
  { key: 'education',        label: 'Education',             icon: 'award', color: '#F59E0B', description: 'Teaching, research, counseling' },
  { key: 'engineering',      label: 'Engineering',           icon: 'tool', color: '#0EA5E9', description: 'Mechanical, civil, electrical' },
  { key: 'media',            label: 'Media & Communication', icon: 'file-text', color: '#FF7A59', description: 'Journalism, PR, broadcasting' },
  { key: 'business',         label: 'Business & Management', icon: 'briefcase', color: '#64748B', description: 'Executive, HR, operations' },
  { key: 'creative',         label: 'Arts & Creative',       icon: 'pen-tool', color: '#E879F9', description: 'Writing, design, music, film' },
  { key: 'science',          label: 'Science & Research',    icon: 'search', color: '#1EE8B5', description: 'Biology, chemistry, physics' },
  { key: 'sales_marketing',  label: 'Sales & Marketing',     icon: 'trending-up', color: '#FBBF24', description: 'Sales, brand, advertising' },
  { key: 'hospitality',      label: 'Hospitality & Service', icon: 'coffee', color: '#FB7185', description: 'Hotels, restaurants, tourism' },
];

export const INDUSTRY_BY_KEY: Record<Industry, IndustryMeta> =
  Object.fromEntries(INDUSTRIES.map(i => [i.key, i])) as any;

export interface Job {
  id: string;             // internal id (slug)
  socCode: string;        // O*NET-SOC 2018 code
  title: string;          // human-readable
  industry: Industry;
  description: string;    // 1-line job summary
  essential: string[];    // COCA codes — must-know
  important: string[];    // COCA codes — high-value secondary
}

// 60 jobs
export const JOBS: Job[] = [
  // TECHNOLOGY (8)
  {
    id: 'software-engineer', socCode: '15-1252.00', industry: 'tech',
    title: 'Software Engineer / Developer',
    description: 'Designs, codes, and tests software applications.',
    essential:  ['ACAD:Sci/Tech', 'Web:Acad',  'Web:Info',   'Web:Instr', 'Blog:Info'],
    important:  ['MAG:Sci/Tech',  'Blog:Instr', 'ACAD:Misc'],
  },
  {
    id: 'data-scientist', socCode: '15-2051.00', industry: 'tech',
    title: 'Data Scientist',
    description: 'Analyses large datasets to inform business decisions.',
    essential:  ['ACAD:Sci/Tech', 'ACAD:Business', 'MAG:Sci/Tech', 'Web:Acad', 'Blog:Info'],
    important:  ['MAG:Financial', 'Web:Info'],
  },
  {
    id: 'devops-engineer', socCode: '15-1244.00', industry: 'tech',
    title: 'DevOps / Cloud Engineer',
    description: 'Maintains infrastructure, CI/CD pipelines, and cloud systems.',
    essential:  ['ACAD:Sci/Tech', 'Web:Instr', 'Web:Info', 'Blog:Instr', 'Blog:Info'],
    important:  ['MAG:Sci/Tech', 'Web:Acad'],
  },
  {
    id: 'frontend-developer', socCode: '15-1254.00', industry: 'tech',
    title: 'Frontend / Web Developer',
    description: 'Builds user-facing web interfaces.',
    essential:  ['Web:Info', 'Web:Instr', 'Web:Revw', 'Blog:Info', 'Blog:Instr'],
    important:  ['MAG:Sci/Tech', 'ACAD:Sci/Tech'],
  },
  {
    id: 'ml-engineer', socCode: '15-2051.01', industry: 'tech',
    title: 'AI / Machine Learning Engineer',
    description: 'Designs and deploys machine-learning models.',
    essential:  ['ACAD:Sci/Tech', 'ACAD:Misc', 'MAG:Sci/Tech', 'Web:Acad', 'Blog:Info'],
    important:  ['NEWS:News_Natl', 'Web:Info'],
  },
  {
    id: 'cybersecurity-analyst', socCode: '15-1212.00', industry: 'tech',
    title: 'Cybersecurity Analyst',
    description: 'Detects and mitigates information-security threats.',
    essential:  ['ACAD:Sci/Tech', 'Web:Legal', 'Web:Info', 'NEWS:News_Natl', 'Blog:Info'],
    important:  ['MAG:Sci/Tech', 'ACAD:Law/PolSci'],
  },
  {
    id: 'database-admin', socCode: '15-1242.00', industry: 'tech',
    title: 'Database Administrator',
    description: 'Manages organisational databases and queries.',
    essential:  ['ACAD:Sci/Tech', 'Web:Instr', 'Web:Info', 'Blog:Instr'],
    important:  ['ACAD:Business', 'MAG:Sci/Tech'],
  },
  {
    id: 'product-manager-tech', socCode: '11-3021.00', industry: 'tech',
    title: 'Tech Product Manager',
    description: 'Drives the strategy and roadmap of a tech product.',
    essential:  ['ACAD:Business', 'MAG:Sci/Tech', 'Web:Info', 'Blog:Info', 'Blog:Revw'],
    important:  ['NEWS:Money', 'MAG:Financial'],
  },

  // HEALTHCARE (6)
  {
    id: 'physician', socCode: '29-1228.00', industry: 'healthcare',
    title: 'Physician (General Practitioner)',
    description: 'Diagnoses and treats human illnesses.',
    essential:  ['ACAD:Medicine', 'ACAD:Sci/Tech', 'MAG:Home/Health', 'Web:Acad', 'NEWS:Life'],
    important:  ['MAG:Sci/Tech', 'Blog:Info'],
  },
  {
    id: 'nurse', socCode: '29-1141.00', industry: 'healthcare',
    title: 'Registered Nurse',
    description: 'Provides patient care under physician guidance.',
    essential:  ['ACAD:Medicine', 'MAG:Home/Health', 'Web:Info', 'NEWS:Life'],
    important:  ['ACAD:Sci/Tech', 'Blog:Info'],
  },
  {
    id: 'pharmacist', socCode: '29-1051.00', industry: 'healthcare',
    title: 'Pharmacist',
    description: 'Dispenses medications and advises on drug therapy.',
    essential:  ['ACAD:Medicine', 'ACAD:Sci/Tech', 'MAG:Home/Health', 'Web:Acad'],
    important:  ['MAG:Sci/Tech', 'Web:Legal'],
  },
  {
    id: 'dentist', socCode: '29-1021.00', industry: 'healthcare',
    title: 'Dentist',
    description: 'Examines, diagnoses, and treats dental issues.',
    essential:  ['ACAD:Medicine', 'MAG:Home/Health', 'Web:Acad', 'Web:Info'],
    important:  ['ACAD:Sci/Tech', 'Blog:Info'],
  },
  {
    id: 'physical-therapist', socCode: '29-1123.00', industry: 'healthcare',
    title: 'Physical Therapist',
    description: 'Helps patients recover mobility through exercise programs.',
    essential:  ['ACAD:Medicine', 'MAG:Home/Health', 'MAG:Sports', 'Web:Info'],
    important:  ['ACAD:Sci/Tech', 'Blog:Info'],
  },
  {
    id: 'medical-researcher', socCode: '19-1042.00', industry: 'healthcare',
    title: 'Medical Researcher',
    description: 'Conducts research into causes and treatments of diseases.',
    essential:  ['ACAD:Medicine', 'ACAD:Sci/Tech', 'MAG:Sci/Tech', 'Web:Acad'],
    important:  ['NEWS:News_Natl', 'NEWS:Life'],
  },

  // FINANCE (5)
  {
    id: 'financial-analyst', socCode: '13-2051.00', industry: 'finance',
    title: 'Financial Analyst',
    description: 'Evaluates investment opportunities for businesses.',
    essential:  ['ACAD:Business', 'MAG:Financial', 'NEWS:Money', 'Web:Info', 'NEWS:News_Natl'],
    important:  ['Blog:Info', 'MAG:News/Opin'],
  },
  {
    id: 'investment-banker', socCode: '13-2052.00', industry: 'finance',
    title: 'Investment Banker / Financial Advisor',
    description: 'Advises clients on mergers, acquisitions, and capital.',
    essential:  ['MAG:Financial', 'NEWS:Money', 'ACAD:Business', 'NEWS:News_Intl', 'Web:Info'],
    important:  ['NEWS:Editorial', 'Blog:Prom'],
  },
  {
    id: 'accountant', socCode: '13-2011.00', industry: 'finance',
    title: 'Accountant / Auditor',
    description: 'Prepares and examines financial records.',
    essential:  ['ACAD:Business', 'NEWS:Money', 'MAG:Financial', 'Web:Info', 'Web:Legal'],
    important:  ['ACAD:Law/PolSci'],
  },
  {
    id: 'actuary', socCode: '15-2011.00', industry: 'finance',
    title: 'Actuary',
    description: 'Quantifies risk and uncertainty for insurance and pensions.',
    essential:  ['ACAD:Business', 'ACAD:Sci/Tech', 'MAG:Financial', 'NEWS:Money'],
    important:  ['ACAD:Misc', 'Web:Info'],
  },
  {
    id: 'risk-manager', socCode: '13-2099.00', industry: 'finance',
    title: 'Risk Manager',
    description: 'Identifies and mitigates organisational risks.',
    essential:  ['ACAD:Business', 'MAG:Financial', 'NEWS:Money', 'Web:Legal', 'NEWS:Editorial'],
    important:  ['ACAD:Law/PolSci', 'NEWS:News_Intl'],
  },

  // LAW & GOVERNMENT (5)
  {
    id: 'lawyer', socCode: '23-1011.00', industry: 'law_government',
    title: 'Lawyer / Attorney',
    description: 'Represents clients and advises on legal matters.',
    essential:  ['ACAD:Law/PolSci', 'Web:Legal', 'Blog:Legal', 'NEWS:Editorial', 'NEWS:News_Natl'],
    important:  ['NEWS:News_Intl', 'ACAD:History'],
  },
  {
    id: 'paralegal', socCode: '23-2011.00', industry: 'law_government',
    title: 'Paralegal',
    description: 'Supports lawyers with research and case preparation.',
    essential:  ['Web:Legal', 'Blog:Legal', 'ACAD:Law/PolSci', 'Web:Info'],
    important:  ['NEWS:Editorial', 'NEWS:News_Natl'],
  },
  {
    id: 'judge', socCode: '23-1023.00', industry: 'law_government',
    title: 'Judge / Magistrate',
    description: 'Presides over judicial proceedings.',
    essential:  ['ACAD:Law/PolSci', 'Web:Legal', 'NEWS:Editorial', 'ACAD:History', 'ACAD:Phil/Rel'],
    important:  ['NEWS:News_Natl', 'NEWS:News_Intl'],
  },
  {
    id: 'policy-analyst', socCode: '19-3094.00', industry: 'law_government',
    title: 'Policy Analyst',
    description: 'Researches and develops public-policy recommendations.',
    essential:  ['ACAD:Law/PolSci', 'ACAD:Geog/SocSci', 'NEWS:Editorial', 'NEWS:News_Intl', 'NEWS:News_Natl'],
    important:  ['MAG:News/Opin', 'Web:Acad'],
  },
  {
    id: 'government-official', socCode: '11-1031.00', industry: 'law_government',
    title: 'Legislator / Government Official',
    description: 'Develops, introduces, or enacts laws and statutes.',
    essential:  ['ACAD:Law/PolSci', 'NEWS:Editorial', 'NEWS:News_Natl', 'NEWS:News_Intl', 'SPOK:CNN'],
    important:  ['ACAD:History', 'MAG:News/Opin'],
  },

  // EDUCATION (4)
  {
    id: 'teacher-k12', socCode: '25-2031.00', industry: 'education',
    title: 'Secondary School Teacher',
    description: 'Teaches academic subjects to middle/high-school students.',
    essential:  ['ACAD:Education', 'ACAD:Humanities', 'MAG:Children', 'FIC:Juvenile', 'Blog:Instr'],
    important:  ['ACAD:History', 'FIC:Gen (Book)'],
  },
  {
    id: 'university-professor', socCode: '25-1099.00', industry: 'education',
    title: 'University Professor',
    description: 'Teaches and conducts research at the tertiary level.',
    essential:  ['ACAD:Education', 'ACAD:Humanities', 'ACAD:Misc', 'Web:Acad', 'Blog:Acad'],
    important:  ['ACAD:History', 'ACAD:Phil/Rel'],
  },
  {
    id: 'school-counselor', socCode: '21-1012.00', industry: 'education',
    title: 'School Counselor',
    description: 'Provides academic and emotional guidance to students.',
    essential:  ['ACAD:Education', 'ACAD:Geog/SocSci', 'MAG:Home/Health', 'Blog:Pers'],
    important:  ['MAG:Women/Men', 'NEWS:Life'],
  },
  {
    id: 'edu-researcher', socCode: '19-3099.00', industry: 'education',
    title: 'Educational Researcher',
    description: 'Studies teaching methods and learning outcomes.',
    essential:  ['ACAD:Education', 'ACAD:Geog/SocSci', 'ACAD:Humanities', 'Web:Acad'],
    important:  ['Blog:Acad', 'MAG:News/Opin'],
  },

  // ENGINEERING (5)
  {
    id: 'mech-engineer', socCode: '17-2141.00', industry: 'engineering',
    title: 'Mechanical Engineer',
    description: 'Designs power-producing and -using machines.',
    essential:  ['ACAD:Sci/Tech', 'MAG:Sci/Tech', 'Web:Acad', 'Web:Instr'],
    important:  ['NEWS:Money', 'Blog:Instr'],
  },
  {
    id: 'civil-engineer', socCode: '17-2051.00', industry: 'engineering',
    title: 'Civil Engineer',
    description: 'Designs roads, bridges, and infrastructure.',
    essential:  ['ACAD:Sci/Tech', 'MAG:Sci/Tech', 'Web:Acad', 'Web:Legal', 'NEWS:News_Local'],
    important:  ['ACAD:Geog/SocSci', 'NEWS:News_Natl'],
  },
  {
    id: 'electrical-engineer', socCode: '17-2071.00', industry: 'engineering',
    title: 'Electrical Engineer',
    description: 'Designs and tests electrical equipment.',
    essential:  ['ACAD:Sci/Tech', 'MAG:Sci/Tech', 'Web:Acad', 'Web:Instr'],
    important:  ['Web:Info', 'NEWS:News_Natl'],
  },
  {
    id: 'chemical-engineer', socCode: '17-2041.00', industry: 'engineering',
    title: 'Chemical Engineer',
    description: 'Designs processes for industrial chemical production.',
    essential:  ['ACAD:Sci/Tech', 'MAG:Sci/Tech', 'Web:Acad'],
    important:  ['Web:Legal', 'NEWS:Money'],
  },
  {
    id: 'aerospace-engineer', socCode: '17-2011.00', industry: 'engineering',
    title: 'Aerospace Engineer',
    description: 'Designs aircraft, spacecraft, and satellites.',
    essential:  ['ACAD:Sci/Tech', 'MAG:Sci/Tech', 'Web:Acad'],
    important:  ['NEWS:News_Natl', 'FIC:SciFi/Fant'],
  },

  // MEDIA & COMMUNICATIONS (5)
  {
    id: 'journalist', socCode: '27-3023.00', industry: 'media',
    title: 'Journalist / News Reporter',
    description: 'Investigates and reports news for publications.',
    essential:  ['NEWS:News_Natl', 'NEWS:News_Intl', 'NEWS:Editorial', 'MAG:News/Opin', 'Blog:News'],
    important:  ['NEWS:News_Local', 'SPOK:CNN'],
  },
  {
    id: 'editor', socCode: '27-3041.00', industry: 'media',
    title: 'Editor',
    description: 'Reviews and polishes content for publication.',
    essential:  ['NEWS:Editorial', 'MAG:News/Opin', 'FIC:Gen (Book)', 'Web:Revw', 'Blog:Info'],
    important:  ['ACAD:Humanities', 'NEWS:News_Natl'],
  },
  {
    id: 'pr-specialist', socCode: '27-3031.00', industry: 'media',
    title: 'Public Relations Specialist',
    description: 'Manages public image for organisations.',
    essential:  ['Blog:Prom', 'NEWS:News_Natl', 'MAG:News/Opin', 'Web:Info', 'NEWS:Editorial'],
    important:  ['MAG:Soc/Arts', 'SPOK:CNN'],
  },
  {
    id: 'broadcast-reporter', socCode: '27-3011.00', industry: 'media',
    title: 'Broadcast News Reporter',
    description: 'Delivers news segments on TV and radio.',
    essential:  ['SPOK:CNN', 'SPOK:ABC', 'SPOK:NBC', 'NEWS:News_Natl', 'NEWS:News_Intl'],
    important:  ['SPOK:NPR', 'NEWS:Editorial'],
  },
  {
    id: 'content-strategist', socCode: '27-3043.00', industry: 'media',
    title: 'Content Strategist / Copywriter',
    description: 'Plans and writes content across digital channels.',
    essential:  ['Web:Info', 'Blog:Info', 'Blog:Prom', 'Web:Revw', 'MAG:Soc/Arts'],
    important:  ['Blog:Pers', 'MAG:News/Opin'],
  },

  // BUSINESS & MANAGEMENT (5)
  {
    id: 'ceo', socCode: '11-1011.00', industry: 'business',
    title: 'Chief Executive (CEO / Director)',
    description: 'Provides strategic leadership to organisations.',
    essential:  ['ACAD:Business', 'NEWS:Money', 'MAG:Financial', 'NEWS:Editorial', 'NEWS:News_Intl'],
    important:  ['MAG:News/Opin', 'SPOK:CNN'],
  },
  {
    id: 'project-manager', socCode: '11-3021.00', industry: 'business',
    title: 'Project Manager',
    description: 'Plans and executes projects across functions.',
    essential:  ['ACAD:Business', 'Web:Instr', 'Web:Info', 'Blog:Info', 'Blog:Instr'],
    important:  ['MAG:Sci/Tech', 'NEWS:Money'],
  },
  {
    id: 'hr-manager', socCode: '11-3121.00', industry: 'business',
    title: 'Human Resources Manager',
    description: 'Oversees recruitment, training, and employee relations.',
    essential:  ['ACAD:Business', 'MAG:Women/Men', 'Blog:Pers', 'Web:Legal', 'Blog:Info'],
    important:  ['ACAD:Education', 'NEWS:News_Natl'],
  },
  {
    id: 'operations-manager', socCode: '11-3071.00', industry: 'business',
    title: 'Operations Manager',
    description: 'Coordinates daily business operations.',
    essential:  ['ACAD:Business', 'NEWS:Money', 'Web:Info', 'Blog:Instr'],
    important:  ['MAG:Financial', 'Web:Instr'],
  },
  {
    id: 'business-analyst', socCode: '13-1111.00', industry: 'business',
    title: 'Business Analyst / Consultant',
    description: 'Recommends improvements to processes and strategy.',
    essential:  ['ACAD:Business', 'MAG:Financial', 'NEWS:Money', 'Web:Info', 'Blog:Info'],
    important:  ['MAG:Sci/Tech', 'NEWS:Editorial'],
  },

  // ARTS & CREATIVE (5)
  {
    id: 'novelist', socCode: '27-3043.05', industry: 'creative',
    title: 'Novelist / Author',
    description: 'Writes fiction books and short stories.',
    essential:  ['FIC:Gen (Book)', 'FIC:Gen (Jrnl)', 'MAG:Soc/Arts', 'ACAD:Humanities', 'Blog:Fic'],
    important:  ['FIC:Movies', 'FIC:SciFi/Fant'],
  },
  {
    id: 'screenwriter', socCode: '27-3043.06', industry: 'creative',
    title: 'Screenwriter',
    description: 'Writes scripts for film and television.',
    essential:  ['Mov:Drama', 'Mov:Comedy', 'TV:Drama', 'FIC:Movies', 'TV:Comedy'],
    important:  ['MAG:Entertain', 'Mov:Romance'],
  },
  {
    id: 'graphic-designer', socCode: '27-1024.00', industry: 'creative',
    title: 'Graphic / UI Designer',
    description: 'Creates visual concepts for print and digital media.',
    essential:  ['MAG:Soc/Arts', 'MAG:Entertain', 'Web:Revw', 'Blog:Info', 'Web:Instr'],
    important:  ['Blog:Prom', 'MAG:Sci/Tech'],
  },
  {
    id: 'film-director', socCode: '27-2012.02', industry: 'creative',
    title: 'Film Director / Producer',
    description: 'Directs creative aspects of film and TV production.',
    essential:  ['Mov:Drama', 'Mov:Comedy', 'TV:Drama', 'MAG:Entertain', 'FIC:Gen (Book)'],
    important:  ['TV:Comedy', 'Mov:Docum'],
  },
  {
    id: 'musician', socCode: '27-2042.00', industry: 'creative',
    title: 'Musician / Singer',
    description: 'Performs and composes music professionally.',
    essential:  ['MAG:Entertain', 'MAG:Soc/Arts', 'Mov:Music', 'Blog:Revw'],
    important:  ['TV:Reality', 'NEWS:Life'],
  },

  // SCIENCE & RESEARCH (4)
  {
    id: 'biologist', socCode: '19-1029.00', industry: 'science',
    title: 'Biologist',
    description: 'Studies living organisms and ecosystems.',
    essential:  ['ACAD:Sci/Tech', 'MAG:Sci/Tech', 'Web:Acad', 'ACAD:Medicine'],
    important:  ['NEWS:Life', 'Blog:Acad'],
  },
  {
    id: 'chemist', socCode: '19-2031.00', industry: 'science',
    title: 'Chemist',
    description: 'Researches chemical compounds and their applications.',
    essential:  ['ACAD:Sci/Tech', 'MAG:Sci/Tech', 'Web:Acad', 'ACAD:Misc'],
    important:  ['ACAD:Medicine', 'NEWS:News_Natl'],
  },
  {
    id: 'physicist', socCode: '19-2012.00', industry: 'science',
    title: 'Physicist / Astronomer',
    description: 'Investigates physical laws of matter and energy.',
    essential:  ['ACAD:Sci/Tech', 'MAG:Sci/Tech', 'Web:Acad', 'ACAD:Phil/Rel'],
    important:  ['FIC:SciFi/Fant', 'NEWS:News_Natl'],
  },
  {
    id: 'env-scientist', socCode: '19-2041.00', industry: 'science',
    title: 'Environmental Scientist',
    description: 'Studies environment and human-impact mitigation.',
    essential:  ['ACAD:Sci/Tech', 'ACAD:Geog/SocSci', 'MAG:Sci/Tech', 'NEWS:News_Intl', 'Web:Acad'],
    important:  ['ACAD:Law/PolSci', 'NEWS:Editorial'],
  },

  // SALES & MARKETING (4)
  {
    id: 'sales-rep', socCode: '41-3091.00', industry: 'sales_marketing',
    title: 'Sales Representative',
    description: 'Sells products or services to businesses and consumers.',
    essential:  ['Blog:Prom', 'Web:Revw', 'NEWS:Money', 'MAG:Soc/Arts', 'Blog:Pers'],
    important:  ['MAG:Financial', 'Web:Info'],
  },
  {
    id: 'marketing-manager', socCode: '11-2021.00', industry: 'sales_marketing',
    title: 'Marketing Manager',
    description: 'Plans and directs marketing strategy.',
    essential:  ['Blog:Prom', 'MAG:Soc/Arts', 'MAG:News/Opin', 'Web:Revw', 'ACAD:Business'],
    important:  ['MAG:Entertain', 'NEWS:Money'],
  },
  {
    id: 'brand-manager', socCode: '11-2021.01', industry: 'sales_marketing',
    title: 'Brand Manager',
    description: 'Manages brand strategy and identity.',
    essential:  ['Blog:Prom', 'MAG:Soc/Arts', 'MAG:Entertain', 'Web:Revw', 'Blog:Revw'],
    important:  ['ACAD:Business', 'NEWS:Money'],
  },
  {
    id: 'seo-specialist', socCode: '15-1255.01', industry: 'sales_marketing',
    title: 'SEO / Digital Marketing Specialist',
    description: 'Optimises websites and ads for search and conversion.',
    essential:  ['Blog:Prom', 'Blog:Info', 'Web:Info', 'Web:Instr', 'Web:Revw'],
    important:  ['MAG:Sci/Tech', 'ACAD:Business'],
  },

  // HOSPITALITY & SERVICE (4)
  {
    id: 'hotel-manager', socCode: '11-9081.00', industry: 'hospitality',
    title: 'Hotel / Lodging Manager',
    description: 'Oversees hotel operations and guest experience.',
    essential:  ['MAG:Soc/Arts', 'NEWS:Life', 'Blog:Prom', 'Web:Revw', 'Blog:Revw'],
    important:  ['MAG:Home/Health', 'ACAD:Business'],
  },
  {
    id: 'restaurant-manager', socCode: '11-9051.00', industry: 'hospitality',
    title: 'Restaurant Manager',
    description: 'Manages restaurant operations and staff.',
    essential:  ['MAG:Home/Health', 'NEWS:Life', 'Blog:Prom', 'Web:Revw', 'Blog:Revw'],
    important:  ['MAG:Entertain', 'ACAD:Business'],
  },
  {
    id: 'chef', socCode: '35-1011.00', industry: 'hospitality',
    title: 'Chef / Head Cook',
    description: 'Plans menus and supervises kitchen operations.',
    essential:  ['MAG:Home/Health', 'NEWS:Life', 'Blog:Revw', 'TV:Reality'],
    important:  ['MAG:Entertain', 'Blog:Prom'],
  },
  {
    id: 'tour-guide', socCode: '39-7011.00', industry: 'hospitality',
    title: 'Tour Guide / Travel Specialist',
    description: 'Provides cultural and historical narration to tourists.',
    essential:  ['NEWS:Life', 'ACAD:History', 'ACAD:Geog/SocSci', 'Blog:Pers', 'MAG:Soc/Arts'],
    important:  ['SPOK:Indep', 'Web:Info'],
  },
];

// Helpers
export const JOBS_BY_ID: Record<string, Job> =
  Object.fromEntries(JOBS.map(j => [j.id, j]));

export function jobsByIndustry(industry: Industry): Job[] {
  return JOBS.filter(j => j.industry === industry);
}

export function findJob(id: string): Job | undefined {
  return JOBS_BY_ID[id];
}

/**
 * For a given job, returns coverage gap analysis vs the user's seen subgenres.
 */
export function analyzeJobCoverage(
  jobId: string,
  coveredCodes: string[],
): {
  essential: { code: string; covered: boolean }[];
  important: { code: string; covered: boolean }[];
  coveredEssential: number;
  totalEssential: number;
  coveredImportant: number;
  totalImportant: number;
  coveragePct: number;
} {
  const job = findJob(jobId);
  if (!job) {
    return {
      essential: [], important: [],
      coveredEssential: 0, totalEssential: 0,
      coveredImportant: 0, totalImportant: 0,
      coveragePct: 0,
    };
  }
  const has = (c: string) => coveredCodes.includes(c);
  const essential = job.essential.map(code => ({ code, covered: has(code) }));
  const important = job.important.map(code => ({ code, covered: has(code) }));
  const covE = essential.filter(e => e.covered).length;
  const covI = important.filter(i => i.covered).length;
  const total = job.essential.length + job.important.length;
  const cov = covE + covI;
  return {
    essential, important,
    coveredEssential: covE, totalEssential: job.essential.length,
    coveredImportant: covI, totalImportant: job.important.length,
    coveragePct: total > 0 ? Math.round(100 * cov / total) : 0,
  };
}

export const JOBS_TOTAL_COUNT = JOBS.length;  // 60
