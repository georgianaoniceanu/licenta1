import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useThemeColor } from '@/hooks/use-theme-color';

interface ParticipantEnrollmentFlowProps {
  onEnrollmentComplete?: (participantId: string) => void;
  apiBaseUrl?: string;
}

type EnrollmentStep = 'welcome' | 'info' | 'consent' | 'enrolled';

export function ParticipantEnrollmentFlow({
  onEnrollmentComplete,
  apiBaseUrl = 'http://localhost:8000',
}: ParticipantEnrollmentFlowProps) {
  const [currentStep, setCurrentStep] = useState<EnrollmentStep>('welcome');
  const [loading, setLoading] = useState(false);
  const [participantId, setParticipantId] = useState<string | null>(null);

  // Consent form state
  const [consent, setConsent] = useState({
    purpose: false,
    timeCommitment: false,
    withdrawal: false,
    dataPrivacy: false,
  });

  // Enrollment form state
  const [formData, setFormData] = useState({
    cefrLevel: 'B1' as 'A2' | 'B1' | 'B2' | 'C1',
    targetTest: 'IELTS' as 'IELTS' | 'TOEFL_IBT' | 'Cambridge_CAE' | 'Cambridge_CPE' | 'APTIS',
    recruitmentMethod: '',
  });

  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const tintColor = useThemeColor({}, 'tint');

  const handleEnroll = async () => {
    if (!Object.values(consent).every(Boolean)) {
      Alert.alert('Incomplete Consent', 'Please agree to all terms before proceeding.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${apiBaseUrl}/assessment/enroll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          l1: 'Romanian',
          cefr_baseline_level: formData.cefrLevel,
          target_test: formData.targetTest,
          recruitment_method: formData.recruitmentMethod,
        }),
      });

      if (!response.ok) throw new Error('Enrollment failed');

      const data = await response.json();
      setParticipantId(data.participant_id);
      setCurrentStep('enrolled');
      onEnrollmentComplete?.(data.participant_id);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Enrollment failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor }]}>
      {/* Step 1: Welcome */}
      {currentStep === 'welcome' && (
        <View style={styles.step}>
          <Text style={[styles.title, { color: textColor }]}>Join Our Study</Text>
          <Text style={[styles.subtitle, { color: textColor }]}>
            Help us validate the English diagnostic system for Romanian learners
          </Text>

          <View style={styles.content}>
            <Text style={[styles.heading, { color: textColor }]}>What is this study?</Text>
            <Text style={[styles.description, { color: textColor }]}>
              We're conducting a 4-10 week research study to validate our AI-powered English
              assessment system. The system analyzes your writing and speaking to provide
              personalized module recommendations.
            </Text>

            <Text style={[styles.heading, { color: textColor }]}>What will you do?</Text>
            <View style={styles.bulletList}>
              <Text style={[styles.bullet, { color: textColor }]}>
                <Text style={{ fontWeight: '600' }}>Week 1-2:</Text> Complete baseline assessment
                (writing + speaking)
              </Text>
              <Text style={[styles.bullet, { color: textColor }]}>
                <Text style={{ fontWeight: '600' }}>Week 2-3:</Text> Randomized to treatment or
                control group
              </Text>
              <Text style={[styles.bullet, { color: textColor }]}>
                <Text style={{ fontWeight: '600' }}>Week 4-6:</Text> Treatment group uses modules
                2-3 hrs/week (control: no access)
              </Text>
              <Text style={[styles.bullet, { color: textColor }]}>
                <Text style={{ fontWeight: '600' }}>Week 7:</Text> Take official IELTS/Cambridge/TOEFL
                exam
              </Text>
            </View>

            <Text style={[styles.heading, { color: textColor }]}>Why participate?</Text>
            <View style={styles.bulletList}>
              <Text style={[styles.bullet, { color: textColor }]}>
                Free personalized learning path
              </Text>
              <Text style={[styles.bullet, { color: textColor }]}>
                Detailed feedback on your English level
              </Text>
              <Text style={[styles.bullet, { color: textColor }]}>
                Contribute to English language learning research
              </Text>
              <Text style={[styles.bullet, { color: textColor }]}>
                Help other Romanian learners
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.button, { backgroundColor: tintColor }]}
            onPress={() => setCurrentStep('info')}
          >
            <Text style={styles.buttonText}>Continue →</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Step 2: Assessment Level & Test */}
      {currentStep === 'info' && (
        <View style={styles.step}>
          <Text style={[styles.title, { color: textColor }]}>Your Information</Text>

          <View style={styles.content}>
            <Text style={[styles.label, { color: textColor }]}>Current English Level (CEFR)</Text>
            <View style={styles.optionGroup}>
              {(['A2', 'B1', 'B2', 'C1'] as const).map((level) => (
                <TouchableOpacity
                  key={level}
                  style={[
                    styles.option,
                    formData.cefrLevel === level && {
                      backgroundColor: tintColor,
                      borderColor: tintColor,
                    },
                  ]}
                  onPress={() => setFormData({ ...formData, cefrLevel: level })}
                >
                  <Text
                    style={[
                      styles.optionText,
                      formData.cefrLevel === level && { color: '#ffffff', fontWeight: '700' },
                    ]}
                  >
                    {level}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={[styles.helper, { color: textColor }]}>
              A2: Elementary | B1: Intermediate | B2: Upper-Intermediate | C1: Advanced
            </Text>

            <Text style={[styles.label, { color: textColor, marginTop: 20 }]}>
              Target Test
            </Text>
            <View style={styles.testGroup}>
              {([
                { label: 'IELTS', value: 'IELTS' },
                { label: 'TOEFL iBT', value: 'TOEFL_IBT' },
                { label: 'Cambridge CAE', value: 'Cambridge_CAE' },
                { label: 'Cambridge CPE', value: 'Cambridge_CPE' },
              ] as const).map(({ label, value }) => (
                <TouchableOpacity
                  key={value}
                  style={[
                    styles.testOption,
                    formData.targetTest === value && {
                      backgroundColor: tintColor,
                      borderColor: tintColor,
                    },
                  ]}
                  onPress={() => setFormData({ ...formData, targetTest: value })}
                >
                  <Text
                    style={[
                      styles.testOptionText,
                      formData.targetTest === value && { color: '#ffffff', fontWeight: '700' },
                    ]}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.buttonGroup}>
            <TouchableOpacity
              style={[styles.button, styles.secondaryButton]}
              onPress={() => setCurrentStep('welcome')}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                <Feather name="chevron-left" size={16} color="#6b7280" />
                <Text style={styles.secondaryButtonText}>Back</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, { backgroundColor: tintColor, flex: 1, marginLeft: 12 }]}
              onPress={() => setCurrentStep('consent')}
            >
              <Text style={styles.buttonText}>Continue →</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Step 3: Informed Consent */}
      {currentStep === 'consent' && (
        <View style={styles.step}>
          <Text style={[styles.title, { color: textColor }]}>Informed Consent</Text>

          <View style={styles.content}>
            <View style={styles.consentSection}>
              <TouchableOpacity
                style={styles.checkboxContainer}
                onPress={() => setConsent({ ...consent, purpose: !consent.purpose })}
              >
                <View
                  style={[
                    styles.checkbox,
                    consent.purpose && { backgroundColor: tintColor, borderColor: tintColor },
                  ]}
                >
                  {consent.purpose && <Text style={styles.checkmark}></Text>}
                </View>
                <Text style={[styles.consentText, { color: textColor }]}>
                  I understand the purpose of this study and what I'll be asked to do.
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.consentSection}>
              <TouchableOpacity
                style={styles.checkboxContainer}
                onPress={() =>
                  setConsent({ ...consent, timeCommitment: !consent.timeCommitment })
                }
              >
                <View
                  style={[
                    styles.checkbox,
                    consent.timeCommitment && {
                      backgroundColor: tintColor,
                      borderColor: tintColor,
                    },
                  ]}
                >
                  {consent.timeCommitment && <Text style={styles.checkmark}></Text>}
                </View>
                <Text style={[styles.consentText, { color: textColor }]}>
                  I can commit 2-3 hours per week for 4-10 weeks, including the official test.
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.consentSection}>
              <TouchableOpacity
                style={styles.checkboxContainer}
                onPress={() => setConsent({ ...consent, withdrawal: !consent.withdrawal })}
              >
                <View
                  style={[
                    styles.checkbox,
                    consent.withdrawal && { backgroundColor: tintColor, borderColor: tintColor },
                  ]}
                >
                  {consent.withdrawal && <Text style={styles.checkmark}></Text>}
                </View>
                <Text style={[styles.consentText, { color: textColor }]}>
                  I understand I can withdraw from the study at any time without penalty.
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.consentSection}>
              <TouchableOpacity
                style={styles.checkboxContainer}
                onPress={() => setConsent({ ...consent, dataPrivacy: !consent.dataPrivacy })}
              >
                <View
                  style={[
                    styles.checkbox,
                    consent.dataPrivacy && { backgroundColor: tintColor, borderColor: tintColor },
                  ]}
                >
                  {consent.dataPrivacy && <Text style={styles.checkmark}></Text>}
                </View>
                <Text style={[styles.consentText, { color: textColor }]}>
                  I consent to the use of my assessment data for research purposes (anonymized).
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity onPress={() => Linking.openURL('/privacy-policy')}>
              <Text style={[styles.link, { color: tintColor }]}>
                Read our full Privacy Policy →
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.buttonGroup}>
            <TouchableOpacity
              style={[styles.button, styles.secondaryButton]}
              onPress={() => setCurrentStep('info')}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                <Feather name="chevron-left" size={16} color="#6b7280" />
                <Text style={styles.secondaryButtonText}>Back</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              disabled={!Object.values(consent).every(Boolean) || loading}
              style={[
                styles.button,
                {
                  backgroundColor:
                    Object.values(consent).every(Boolean) && !loading ? tintColor : '#d1d5db',
                  flex: 1,
                  marginLeft: 12,
                },
              ]}
              onPress={handleEnroll}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.buttonText}>Complete Enrollment</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Step 4: Confirmation */}
      {currentStep === 'enrolled' && participantId && (
        <View style={styles.step}>
          <Feather name="check-circle" size={48} color="#0FBA9A" style={styles.successEmoji} />
          <Text style={[styles.title, { color: textColor }]}>Successfully Enrolled!</Text>

          <View style={[styles.successBox, { backgroundColor: '#d1fae5' }]}>
            <Text style={[styles.successText, { color: '#065f46' }]}>
              Your anonymous participant ID is:
            </Text>
            <Text style={[styles.participantId, { color: '#065f46' }]}>{participantId}</Text>
            <Text style={[styles.successText, { color: '#065f46', marginTop: 8 }]}>
              Save this for reference. You'll need it to log in for assessments.
            </Text>
          </View>

          <View style={styles.content}>
            <Text style={[styles.heading, { color: textColor }]}>Next Steps:</Text>
            <View style={styles.bulletList}>
              <Text style={[styles.bullet, { color: textColor }]}>
                1⃣ You'll receive an email with baseline assessment details
              </Text>
              <Text style={[styles.bullet, { color: textColor }]}>
                2⃣ Complete baseline (writing + speaking) by {new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString()}
              </Text>
              <Text style={[styles.bullet, { color: textColor }]}>
                3⃣ We'll randomize you to treatment or control group
              </Text>
              <Text style={[styles.bullet, { color: textColor }]}>
                4⃣ Begin your study phase
              </Text>
            </View>

            <Text style={[styles.heading, { color: textColor }]}>Questions?</Text>
            <Text style={[styles.description, { color: textColor }]}>
              Contact us at research@vocaflow.com or visit our FAQ page.
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.button, { backgroundColor: tintColor }]}
            onPress={() => {
              // Navigate to home or dashboard
              Alert.alert('Success', 'Your enrollment is complete!');
            }}
          >
            <Text style={styles.buttonText}>Go to Dashboard →</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  step: {
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    opacity: 0.7,
    marginBottom: 20,
  },
  successEmoji: {
    fontSize: 64,
    textAlign: 'center',
    marginBottom: 16,
  },
  content: {
    marginBottom: 24,
  },
  heading: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
    marginTop: 16,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  bulletList: {
    marginBottom: 12,
  },
  bullet: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  helper: {
    fontSize: 12,
    opacity: 0.6,
    marginTop: 8,
  },
  optionGroup: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  option: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  testGroup: {
    gap: 8,
  },
  testOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderRadius: 8,
  },
  testOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  consentSection: {
    marginBottom: 16,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: '#d1d5db',
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkmark: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  consentText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  link: {
    fontSize: 13,
    fontWeight: '600',
    textDecorationLine: 'underline',
    marginTop: 12,
  },
  successBox: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  successText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  participantId: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 8,
    letterSpacing: 1,
  },
  buttonGroup: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  secondaryButton: {
    borderWidth: 2,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#6b7280',
  },
});
