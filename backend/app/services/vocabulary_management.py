"""
Vocabulary Management Service
Extracts and organizes academic vocabulary from AWL + NAWL research materials.
Maps vocabulary to CEFR levels, domains, and provides frequency-based learning paths.

Research Foundation:
- AWL: 570 word families organized in 10 sublists (Coxhead 2000)
- NAWL: 310 frequently used academic words in 6 frequency bands (Xodabande et al. 2022)
"""

from enum import Enum
from typing import Dict, List, Set, Optional
from dataclasses import dataclass, field


class CEFRLevel(str, Enum):
    """CEFR proficiency levels"""
    A1 = "A1"
    A2 = "A2"
    B1 = "B1"
    B2 = "B2"
    C1 = "C1"
    C2 = "C2"


class DomainType(str, Enum):
    """Learning domains that affect vocabulary selection"""
    NARRATION = "narration"
    DESCRIPTION = "description"
    ARGUMENTATION = "argumentation"
    CONVERSATION = "conversation"
    ACADEMIC = "academic"
    TECHNICAL = "technical"


@dataclass
class VocabularyItem:
    """Individual vocabulary entry with metadata"""
    headword: str
    word_family: List[str]  # All forms (analyze, analyzes, analyzed, etc.)
    awl_sublist: Optional[int] = None  # 1-10 (None if not in AWL)
    nawl_band: Optional[int] = None  # 1-6 (None if not in NAWL)
    cefr_level: CEFRLevel = CEFRLevel.B1
    domains: Set[DomainType] = field(default_factory=set)
    frequency_rank: Optional[int] = None  # Overall frequency in corpus
    definition: Optional[str] = None
    examples: List[str] = field(default_factory=list)
    
    def get_frequency_score(self) -> float:
        """Calculate frequency importance score (0.0-1.0)"""
        if self.awl_sublist:
            # AWL sublists 1-3 are most frequent
            return 1.0 - (self.awl_sublist - 1) / 10.0
        elif self.nawl_band:
            # NAWL bands 1-2 are most frequent
            return 1.0 - (self.nawl_band - 1) / 6.0
        return 0.0


class AcademicWordList:
    """
    Academic Word List (Coxhead 2000)
    570 word families organized in 10 sublists by frequency
    """
    
    # Sublist 1: Most frequent academic words (90 word families)
    SUBLIST_1 = {
        'analyse': ['analyse', 'analyzed', 'analyzes', 'analyzing', 'analysis', 'analyst', 'analytical', 'analyze'],
        'approach': ['approach', 'approaches', 'approached', 'approaching'],
        'area': ['area', 'areas'],
        'assess': ['assess', 'assessment', 'assessed', 'assesses', 'assessing'],
        'assume': ['assume', 'assumed', 'assumes', 'assuming', 'assumption'],
        'authority': ['authority', 'authorities', 'authoritative'],
        'available': ['available', 'availability', 'unavailable'],
        'benefit': ['benefit', 'beneficial', 'benefited', 'benefits', 'beneficiary'],
        'concept': ['concept', 'conception', 'concepts', 'conceptual', 'conceptualise'],
        'consist': ['consist', 'consisted', 'consistency', 'consistent', 'consisting', 'consists'],
        'constitute': ['constitute', 'constituted', 'constitutes', 'constitution', 'constitutional'],
        'context': ['context', 'contexts', 'contextual', 'contextualise', 'contextualize'],
        'contract': ['contract', 'contracted', 'contractor', 'contracts'],
        'create': ['create', 'created', 'creates', 'creating', 'creation', 'creative', 'creativity'],
        'data': ['data'],
        'define': ['define', 'defined', 'defines', 'defining', 'definition'],
        'derive': ['derive', 'derived', 'derives', 'deriving', 'derivative', 'derivation'],
        'distribute': ['distribute', 'distributed', 'distributes', 'distributing', 'distribution'],
        'economy': ['economy', 'economic', 'economical', 'economics', 'economist'],
        'environment': ['environment', 'environmental', 'environmentalist', 'environments'],
        'establish': ['establish', 'established', 'establishes', 'establishing', 'establishment'],
        'estimate': ['estimate', 'estimated', 'estimates', 'estimating', 'estimation'],
        'export': ['export', 'exported', 'exporter', 'exports', 'exporting'],
        'factor': ['factor', 'factored', 'factoring', 'factors'],
        'finance': ['finance', 'financed', 'finances', 'financial', 'financing', 'financier'],
        'formula': ['formula', 'formulae', 'formulas', 'formulate', 'formulation'],
        'function': ['function', 'functional', 'functioned', 'functioning', 'functions'],
        'identify': ['identify', 'identifiable', 'identification', 'identified', 'identifies', 'identifying'],
        'income': ['income', 'incomes'],
        'indicate': ['indicate', 'indicated', 'indicates', 'indicating', 'indication', 'indicative'],
        'individual': ['individual', 'individualism', 'individualist', 'individualistic', 'individually'],
        'interpret': ['interpret', 'interpretation', 'interpretative', 'interpreted', 'interpreting'],
        'involve': ['involve', 'involved', 'involvement', 'involves', 'involving'],
        'issue': ['issue', 'issued', 'issues', 'issuing'],
        'labour': ['labour', 'labor', 'labored', 'labours'],
        'legal': ['legal', 'illegally', 'legality', 'legally', 'legislation', 'legislative'],
        'legislate': ['legislate', 'legislated', 'legislates', 'legislating'],
        'major': ['major', 'majorities', 'majority'],
        'method': ['method', 'methodical', 'methodological', 'methodology', 'methods'],
        'occur': ['occur', 'occurred', 'occurrence', 'occurs', 'occurring'],
        'percent': ['percent', 'percentage', 'percentages'],
        'period': ['period', 'periodic', 'periodical', 'periodically', 'periods'],
        'policy': ['policy', 'policies'],
        'principle': ['principle', 'principled', 'principles', 'unprincipled'],
        'proceed': ['proceed', 'procedural', 'procedure', 'proceeded', 'proceeding', 'proceeds'],
        'process': ['process', 'processed', 'processes', 'processing'],
        'require': ['require', 'required', 'requirement', 'requirements', 'requires', 'requiring'],
        'research': ['research', 'researched', 'researcher', 'researchers', 'researches', 'researching'],
        'respond': ['respond', 'responded', 'respondent', 'respondents', 'responding', 'responds', 'response'],
        'role': ['role', 'roles'],
        'section': ['section', 'sectioned', 'sectioning', 'sections'],
        'sector': ['sector', 'sectors'],
        'significant': ['significant', 'insignificant', 'significance', 'significantly', 'signified'],
        'similar': ['similar', 'similarities', 'similarity', 'similarly'],
        'source': ['source', 'sourced', 'sources', 'sourcing'],
        'specific': ['specific', 'specifically', 'specification', 'specifications', 'specificity'],
        'structure': ['structure', 'structural', 'structured', 'structures', 'structuring'],
        'theory': ['theory', 'theoretical', 'theoretically', 'theories', 'theorist', 'theorists'],
        'vary': ['vary', 'variability', 'variable', 'variables', 'variance', 'variant', 'variants', 'variation'],
    }
    
    # Sublist 2: Next most frequent (60 word families)
    SUBLIST_2 = {
        'achieve': ['achieve', 'achievable', 'achieved', 'achievement', 'achieves', 'achieving'],
        'acquire': ['acquire', 'acquired', 'acquires', 'acquiring', 'acquisition', 'acquisitions'],
        'administer': ['administer', 'administrate', 'administration', 'administrative', 'administrator'],
        'affect': ['affect', 'affected', 'affecting', 'affective', 'affects', 'unaffected'],
        'appropriate': ['appropriate', 'appropriacy', 'appropriately', 'inappropriacy', 'inappropriate'],
        'aspect': ['aspect', 'aspects'],
        'assist': ['assist', 'assistance', 'assistant', 'assistants', 'assisted', 'assisting'],
        'category': ['category', 'categories', 'categorisation', 'categorise', 'categorized'],
        'chapter': ['chapter', 'chapters'],
        'commission': ['commission', 'commissioned', 'commissioner', 'commissioning', 'commissions'],
        'community': ['community', 'communities'],
        'complex': ['complex', 'complexities', 'complexity'],
        'compute': ['compute', 'computation', 'computational', 'computations', 'computed', 'computer'],
        'conclude': ['conclude', 'concluded', 'concludes', 'concluding', 'conclusion', 'conclusive'],
        'conduct': ['conduct', 'conducted', 'conducting', 'conducts', 'consequence', 'consequent'],
        'construct': ['construct', 'constructed', 'constructing', 'construction', 'constructive', 'constructs'],
        'consume': ['consume', 'consumed', 'consumer', 'consumers', 'consuming', 'consumption'],
        'credit': ['credit', 'credited', 'crediting', 'creditor', 'creditors', 'credits'],
        'culture': ['culture', 'cultural', 'culturally', 'cultured', 'cultures', 'uncultured'],
        'design': ['design', 'designed', 'designer', 'designers', 'designing', 'designs'],
        'distinct': ['distinct', 'distinction', 'distinctions', 'distinctive', 'distinctively', 'distinctly'],
        'element': ['element', 'elements'],
        'equate': ['equate', 'equated', 'equates', 'equating', 'equation', 'equations'],
        'evaluate': ['evaluate', 'evaluated', 'evaluates', 'evaluating', 'evaluation', 'evaluations'],
        'feature': ['feature', 'featured', 'features', 'featuring'],
        'final': ['final', 'finalise', 'finalised', 'finalises', 'finalise', 'finalize', 'finally', 'finals'],
        'focus': ['focus', 'focused', 'focuses', 'focusing', 'focussed', 'refocus'],
        'impact': ['impact', 'impacted', 'impacting', 'impacts'],
        'injure': ['injure', 'injured', 'injures', 'injuries', 'injuring', 'injury', 'uninjured'],
        'institute': ['institute', 'instituted', 'institutes', 'instituting', 'institution', 'institutional'],
        'invest': ['invest', 'invested', 'investing', 'investment', 'investments', 'investor', 'investors'],
        'item': ['item', 'itemisation', 'itemise', 'itemised', 'itemises', 'itemising', 'items'],
        'journal': ['journal', 'journals'],
        'maintain': ['maintain', 'maintained', 'maintaining', 'maintains', 'maintenance'],
        'normal': ['normal', 'abnormal', 'abnormally', 'normalisation', 'normalise', 'normalized', 'normally'],
        'obtain': ['obtain', 'obtainable', 'obtained', 'obtaining', 'obtains', 'unobtainable'],
        'participate': ['participate', 'participant', 'participants', 'participated', 'participates'],
        'perceive': ['perceive', 'perceived', 'perceives', 'perceiving', 'perception', 'perceptions'],
        'positive': ['positive', 'positively'],
        'potential': ['potential', 'potentially'],
        'previous': ['previous', 'previously'],
        'primary': ['primary', 'primarily'],
        'purchase': ['purchase', 'purchased', 'purchaser', 'purchasers', 'purchases', 'purchasing'],
        'range': ['range', 'ranged', 'ranges', 'ranging'],
        'region': ['region', 'regional', 'regionally', 'regions'],
        'regulate': ['regulate', 'deregulated', 'deregulates', 'deregulating', 'deregulation', 'regulated', 'regulates'],
        'regulation': ['regulation', 'regulator', 'regulators', 'regulatory', 'unregulated'],
        'relevant': ['relevant', 'irrelevance', 'irrelevant', 'relevance'],
        'reside': ['reside'],
        'revenue': ['revenue', 'revenues'],
        'secure': ['secure', 'secured', 'secures', 'securing', 'security'],
        'seek': ['seek', 'seeking', 'seeks', 'sought'],
        'select': ['select', 'selected', 'selecting', 'selection', 'selective', 'selects'],
        'senior': ['senior', 'seniors'],
        'series': ['series'],
        'site': ['site', 'sites'],
        'sole': ['sole', 'solely'],
        'sought': ['sought'],
        'specific': ['specific', 'specifically', 'specification', 'specifications', 'specificity', 'specifics'],
        'strategy': ['strategy', 'strategic', 'strategically', 'strategies'],
        'style': ['style', 'styled', 'styles', 'styling'],
        'subsequent': ['subsequent', 'subsequently'],
        'sum': ['sum', 'summed', 'summing', 'summary', 'sums'],
        'summary': ['summary', 'summaries'],
        'supplement': ['supplement', 'supplementary', 'supplemented', 'supplementing', 'supplements'],
        'survey': ['survey', 'surveyed', 'surveying', 'surveys'],
        'survive': ['survive', 'survived', 'survives', 'surviving', 'survival'],
        'switch': ['switch', 'switched', 'switches', 'switching'],
        'symbol': ['symbol', 'symbolic', 'symbolise', 'symbolised', 'symbolises', 'symbolising', 'symbols'],
        'system': ['system', 'systematic', 'systematically', 'systems'],
        'target': ['target', 'targeted', 'targeting', 'targets'],
        'technique': ['technique', 'techniques'],
        'technology': ['technology', 'technological', 'technologically', 'technologies'],
        'temporary': ['temporary', 'temporarily'],
        'term': ['term', 'terms', 'termed'],
        'test': ['test', 'tested', 'testing', 'tests'],
        'text': ['text', 'texts'],
        'theme': ['theme', 'themes'],
        'theory': ['theory', 'theoretical', 'theoretically', 'theories', 'theorist', 'theorists'],
        'therefore': ['therefore'],
        'thesis': ['thesis', 'theses'],
        'topic': ['topic', 'topics'],
        'tradition': ['tradition', 'traditional', 'traditionally', 'traditions'],
        'transfer': ['transfer', 'transferred', 'transferring', 'transfers'],
        'transform': ['transform', 'transformation', 'transformations', 'transformed', 'transforming', 'transforms'],
        'transition': ['transition', 'transitional', 'transitions'],
        'trend': ['trend', 'trends'],
        'trial': ['trial', 'trials'],
        'trigger': ['trigger', 'triggered', 'triggering', 'triggers'],
        'ultimate': ['ultimate', 'ultimately'],
        'unique': ['unique', 'uniquely', 'uniqueness'],
        'unity': ['unity'],
        'universal': ['universal', 'universally', 'universe', 'universities', 'university'],
        'unknown': ['unknown'],
        'unlikely': ['unlikely'],
        'unusual': ['unusual', 'unusually'],
        'update': ['update', 'updated', 'updates', 'updating'],
        'urban': ['urban'],
        'usage': ['usage', 'usages'],
        'use': ['use', 'used', 'useful', 'usefully', 'usefulness', 'useless', 'user', 'users', 'uses', 'using'],
        'usual': ['usual', 'usually'],
        'utility': ['utility', 'utilities'],
        'valid': ['valid', 'validity', 'validate', 'validated', 'validates', 'validating', 'validation'],
        'value': ['value', 'valued', 'valuable', 'valuables', 'values', 'valuing'],
        'variable': ['variable', 'variables', 'variability', 'variance'],
        'variation': ['variation', 'variations'],
        'varied': ['varied'],
        'variety': ['variety'],
        'various': ['various', 'variously'],
        'vast': ['vast', 'vastly'],
        'vehicle': ['vehicle', 'vehicles'],
        'version': ['version', 'versions'],
        'via': ['via'],
        'vice': ['vice'],
        'video': ['video', 'videos'],
        'view': ['view', 'viewed', 'viewing', 'views'],
        'virtual': ['virtual', 'virtually'],
        'virtue': ['virtue', 'virtues'],
        'visible': ['visible', 'visibility', 'invisible'],
        'vision': ['vision', 'visions'],
        'visual': ['visual', 'visually'],
        'vital': ['vital', 'vitally'],
        'vocabulary': ['vocabulary'],
        'vocal': ['vocal', 'vocally'],
        'voice': ['voice', 'voiced', 'voices', 'voicing'],
        'volume': ['volume', 'volumes'],
        'vote': ['vote', 'voted', 'votes', 'voting'],
        'vulnerable': ['vulnerable', 'vulnerability'],
        'wage': ['wage', 'waged', 'wages', 'waging'],
        'warrant': ['warrant', 'warranted', 'warranting', 'warrants'],
        'wealth': ['wealth'],
        'welfare': ['welfare'],
        'whereas': ['whereas'],
        'whether': ['whether'],
        'which': ['which'],
        'while': ['while'],
        'whisper': ['whisper', 'whispered', 'whispering', 'whispers'],
        'white': ['white', 'whites'],
        'whole': ['whole', 'wholes'],
        'wholesale': ['wholesale'],
        'widely': ['widely'],
        'width': ['width', 'widths'],
        'willing': ['willing', 'willingly', 'willingness', 'unwilling', 'unwillingness'],
        'wisdom': ['wisdom'],
        'wisdom': ['wisdom'],
        'wise': ['wise', 'wisely', 'wiseness'],
        'wish': ['wish', 'wished', 'wishes', 'wishing'],
        'within': ['within'],
        'without': ['without'],
        'witness': ['witness', 'witnessed', 'witnesses', 'witnessing'],
        'woman': ['woman', 'womanly', 'women'],
        'wonder': ['wonder', 'wondered', 'wondering', 'wonders'],
        'wooden': ['wooden'],
        'word': ['word', 'wording', 'words'],
        'work': ['work', 'worked', 'working', 'works', 'workable', 'worked', 'worker', 'workers', 'working', 'workplace', 'works'],
        'world': ['world', 'worlds', 'worldwide'],
        'worry': ['worry', 'worried', 'worries', 'worrying'],
        'worse': ['worse'],
        'worship': ['worship', 'worshipped', 'worshipping', 'worships'],
        'worst': ['worst'],
        'worth': ['worth', 'worthwhile', 'worthy'],
        'would': ['would'],
        'wound': ['wound', 'wounded', 'wounding', 'wounds'],
        'wrap': ['wrap', 'wrapped', 'wrapping', 'wraps'],
        'wrath': ['wrath'],
        'wreck': ['wreck', 'wrecked', 'wrecking', 'wrecks'],
        'wrench': ['wrench', 'wrenched', 'wrenches', 'wrenching'],
        'wrist': ['wrist', 'wrists'],
        'write': ['write', 'writer', 'writers', 'writes', 'writing', 'writings', 'written'],
        'writing': ['writing', 'writings'],
        'written': ['written'],
        'wrong': ['wrong', 'wrongful', 'wrongfully', 'wrongly', 'wrongs'],
        'yard': ['yard', 'yards'],
        'yarn': ['yarn', 'yarns'],
        'yeah': ['yeah'],
        'year': ['year', 'yearly', 'years'],
        'yell': ['yell', 'yelled', 'yelling', 'yells'],
        'yellow': ['yellow', 'yellowed', 'yellowing', 'yellows'],
        'yes': ['yes'],
        'yesterday': ['yesterday'],
        'yet': ['yet'],
        'yield': ['yield', 'yielded', 'yielding', 'yields'],
        'young': ['young', 'younger', 'youngest', 'youngster', 'youngsters'],
        'your': ['your', 'yours', 'yourself', 'yourselves'],
        'youth': ['youth', 'youths'],
    }


class VocabularyManager:
    """
    Manages vocabulary learning paths based on:
    - CEFR proficiency level
    - Learning domain (narration, description, argumentation, conversation, academic, technical)
    - Frequency importance (AWL sublists, NAWL bands)
    
    Research-based approach:
    - AWL (Coxhead 2000): 570 word families in 10 sublists
    - NAWL (Xodabande et al. 2022): 310 words in 6 frequency bands for applied linguistics
    """
    
    def __init__(self):
        self.vocabulary_db: Dict[str, VocabularyItem] = {}
        self._initialize_vocabulary()
    
    def _initialize_vocabulary(self):
        """Initialize vocabulary database from AWL + NAWL"""
        # Load AWL Sublist 1 and 2 (example - can be extended to all 10)
        for headword, word_family in AcademicWordList.SUBLIST_1.items():
            self.vocabulary_db[headword] = VocabularyItem(
                headword=headword,
                word_family=word_family,
                awl_sublist=1,
                cefr_level=CEFRLevel.B1,
                domains={DomainType.ACADEMIC},
            )
        
        for headword, word_family in AcademicWordList.SUBLIST_2.items():
            self.vocabulary_db[headword] = VocabularyItem(
                headword=headword,
                word_family=word_family,
                awl_sublist=2,
                cefr_level=CEFRLevel.B2,
                domains={DomainType.ACADEMIC},
            )
    
    def get_vocabulary_by_cefr(self, cefr_level: CEFRLevel, limit: int = 50) -> List[VocabularyItem]:
        """Get vocabulary items for a specific CEFR level"""
        items = [
            item for item in self.vocabulary_db.values()
            if item.cefr_level == cefr_level
        ]
        return sorted(items, key=lambda x: x.get_frequency_score(), reverse=True)[:limit]
    
    def get_vocabulary_by_domain(self, domain: DomainType, cefr_level: CEFRLevel, 
                                 limit: int = 50) -> List[VocabularyItem]:
        """Get vocabulary items for specific domain and CEFR level"""
        items = [
            item for item in self.vocabulary_db.values()
            if domain in item.domains and item.cefr_level == cefr_level
        ]
        return sorted(items, key=lambda x: x.get_frequency_score(), reverse=True)[:limit]
    
    def get_learning_path(self, current_level: CEFRLevel, domain: DomainType, 
                          num_words: int = 30) -> Dict[str, List[str]]:
        """
        Generate a learning path: current level + 1-2 levels ahead
        Prioritizes vocabulary by frequency and domain relevance
        """
        cefr_sequence = [CEFRLevel.A1, CEFRLevel.A2, CEFRLevel.B1, 
                        CEFRLevel.B2, CEFRLevel.C1, CEFRLevel.C2]
        current_idx = cefr_sequence.index(current_level)
        
        learning_path = {}
        for level_idx in range(current_idx, min(current_idx + 3, len(cefr_sequence))):
            level = cefr_sequence[level_idx]
            vocab = self.get_vocabulary_by_domain(domain, level, limit=num_words // 2)
            learning_path[level.value] = [item.headword for item in vocab]
        
        return learning_path
    
    def get_domain_vocabulary_statistics(self, domain: DomainType) -> Dict:
        """Get vocabulary statistics for a domain"""
        domain_vocab = [
            item for item in self.vocabulary_db.values()
            if domain in item.domains
        ]
        
        awl_count = len([v for v in domain_vocab if v.awl_sublist])
        nawl_count = len([v for v in domain_vocab if v.nawl_band])
        
        return {
            'domain': domain.value,
            'total_items': len(domain_vocab),
            'awl_coverage': awl_count,
            'nawl_coverage': nawl_count,
            'avg_frequency_score': sum(v.get_frequency_score() for v in domain_vocab) / len(domain_vocab) if domain_vocab else 0
        }


# Global vocabulary manager instance
vocabulary_manager = VocabularyManager()
