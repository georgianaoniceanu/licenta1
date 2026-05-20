import matplotlib.pyplot as plt
import numpy as np
import seaborn as sns
from pathlib import Path

"""
Visualization: Romanian Speakers' Phonological Difficulties in English
Based on Măchiță (2021) research data
"""

# Error rate data - from research
phonemes = [
    "/i:/-/ɪ/", "/u:/-/ʊ/", "/æ/-/ɑ:/", "/ʌ/", "/ə/",
    "/θ/", "/ð/", "/ŋ/", "[ɫ]", "[pʰ]", "[tʰ]", "[kʰ]"
]

error_categories = [
    "Error Rate (%)",
    "Difficulty Score",
    "Consistency Issues"
]

# Create data matrix (values 0-100 for heatmap)
data = np.array([
    # Vowels: Error Rate, Difficulty, Consistency
    [90, 95, 85],   # /i:/-/ɪ/
    [100, 100, 95], # /u:/-/ʊ/ - WORST
    [55, 65, 50],   # /æ/-/ɑ:/
    [65, 70, 60],   # /ʌ/
    [40, 45, 30],   # /ə/
    
    # Consonants: Error Rate, Difficulty, Consistency
    [90, 90, 85],   # /θ/
    [95, 95, 90],   # /ð/ - NEARLY WORST
    [50, 75, 55],   # /ŋ/  - 50% add extra sound
    [60, 70, 50],   # [ɫ]
    [70, 80, 65],   # [pʰ] - over-aspiration
    [70, 80, 75],   # [tʰ] - rare aspiration
    [70, 80, 70],   # [kʰ] - over-aspiration
])

# Create figure with style
plt.style.use('seaborn-v0_8-darkgrid')
fig, ax = plt.subplots(figsize=(14, 8))

# Create heatmap
sns.heatmap(
    data.T,
    annot=True,
    fmt='d',
    cmap='RdYlGn_r',  # Red = hard, Yellow = medium, Green = easy
    xticklabels=phonemes,
    yticklabels=error_categories,
    cbar_kws={'label': 'Difficulty Level (0-100)'},
    linewidths=2,
    linecolor='white',
    vmin=0,
    vmax=100,
    annot_kws={'size': 11, 'weight': 'bold'},
    ax=ax
)

# Styling
ax.set_title(
    'Romanian Speakers\' English Phonological Difficulties\n'
    'Based on Măchiță (2021) - Acquisition of English Phonology by Romanian Learners',
    fontsize=16,
    fontweight='bold',
    pad=20
)

ax.set_xlabel('English Phonemes / Allophones', fontsize=13, fontweight='bold')
ax.set_ylabel('Assessment Metrics', fontsize=13, fontweight='bold')

# Rotate labels for readability
plt.xticks(rotation=45, ha='right', fontsize=11)
plt.yticks(rotation=0, fontsize=11)

# Add annotations for critical issues
fig.text(0.98, 0.95, '🔴 CRITICAL: /u:/-/ʊ/ (Score: 100)', 
         ha='right', fontsize=10, color='red', fontweight='bold',
         bbox=dict(boxstyle='round', facecolor='yellow', alpha=0.7))

# Tight layout
plt.tight_layout()

# Save figure
output_path = Path('backend/app/static/romanian_phoneme_heatmap.png')
output_path.parent.mkdir(parents=True, exist_ok=True)
plt.savefig(output_path, dpi=300, bbox_inches='tight')
print(f"✅ Heatmap saved to: {output_path}")

# Also create a bar chart showing error rates
fig2, ax2 = plt.subplots(figsize=(14, 6))

error_rates = data[:, 0]  # First column = error rates
colors = ['#d62728' if x >= 90 else '#ff7f0e' if x >= 60 else '#2ca02c' for x in error_rates]

bars = ax2.barh(phonemes, error_rates, color=colors, edgecolor='black', linewidth=1.5)

# Add value labels
for i, (bar, rate) in enumerate(zip(bars, error_rates)):
    ax2.text(rate + 2, i, f'{int(rate)}%', va='center', fontweight='bold', fontsize=10)

ax2.set_xlabel('Error Rate Among Romanian Speakers (%)', fontsize=12, fontweight='bold')
ax2.set_title(
    'Romanian Speakers\' Error Rates by English Phoneme\n'
    'Red = Critical (≥90%), Orange = High (60-89%), Green = Lower (<60%)',
    fontsize=14,
    fontweight='bold',
    pad=15
)

ax2.set_xlim(0, 110)
ax2.grid(axis='x', alpha=0.3)

plt.tight_layout()
output_path2 = Path('backend/app/static/romanian_phoneme_errors.png')
plt.savefig(output_path2, dpi=300, bbox_inches='tight')
print(f"✅ Error rate chart saved to: {output_path2}")

plt.show()
