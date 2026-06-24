/**
 * Central registry of illustration assets (unDraw, transparent + IPA diagrams).
 * Screens reference `Illustrations.x` instead of scattered require() paths.
 * NOTE: Metro needs literal require() strings — do not refactor to variables.
 */
export const Illustrations = {
  // Module heroes
  accent:        require('../assets/icons/undraw_speech-to-text_4kov-removebg-preview.png'),
  shadow:        require('../assets/icons/undraw_podcast-listener_dpel-removebg-preview.png'),
  vocabulary:    require('../assets/icons/undraw_open-book_pet1-removebg-preview.png'),

  // Secondary / accents
  micDrop:       require('../assets/icons/undraw_mic-drop_vscc-removebg-preview.png'),
  recording:     require('../assets/icons/undraw_recording_1q6x-removebg-preview.png'),
  audioPlayer:   require('../assets/icons/undraw_audio-player_7uwh-removebg-preview.png'),
  audioFiles:    require('../assets/icons/undraw_audio-files_cgj7-removebg-preview.png'),
  voiceMessages: require('../assets/icons/undraw_voice-messages_anpq-removebg-preview.png'),

  // Onboarding (one per step)
  obLevel:       require('../assets/icons/undraw_online-profile_v9c1-removebg-preview.png'),
  obJob:         require('../assets/icons/undraw_interview_yz52-removebg-preview.png'),
  obGoal:        require('../assets/icons/undraw_personal-goals_f9bb-removebg-preview.png'),
  obDomain:      require('../assets/icons/undraw_target_d6hf-removebg-preview.png'),
  obWeak:        require('../assets/icons/undraw_portfolio-feedback_4iok-removebg-preview.png'),
  obTime:        require('../assets/icons/undraw_setup_fzje-removebg-preview.png'),

  // Diagnostic / progress / achievement
  diagnostic:       require('../assets/icons/undraw_knowledge_0ty5-removebg-preview.png'),
  celebration:      require('../assets/icons/undraw_celebration_wtm8-removebg-preview.png'),
  accomplishments:  require('../assets/icons/undraw_accomplishments_tb6k-removebg-preview.png'),
  steppingUp:       require('../assets/icons/undraw_stepping-up_i0i7-removebg-preview.png'),
  graduation:       require('../assets/icons/undraw_graduation_u7uc-removebg-preview.png'),
  goals:            require('../assets/icons/undraw_goals_dwgr-removebg-preview.png'),
  percentages:      require('../assets/icons/undraw_percentages_wi9e-removebg-preview.png'),
  progressData:     require('../assets/icons/undraw_progress-data_gvcq-removebg-preview.png'),
  progressTracking: require('../assets/icons/undraw_progress-tracking_9m3o-removebg-preview.png'),
  progressOverview: require('../assets/icons/undraw_progress-overview_wl8n-removebg-preview.png'),
  completion:       require('../assets/icons/undraw_completion-progress_o56q-removebg-preview.png'),

  // Empty states
  emptyRecord:   require('../assets/icons/undraw_voice-assistant_k27k-removebg-preview.png'),
  emptyNotes:    require('../assets/icons/undraw_add-notes_9xls-removebg-preview.png'),
  emptyVoice:    require('../assets/icons/undraw_voice-notes_x4kp-removebg-preview.png'),
  emptyHistory:  require('../assets/icons/undraw_no-data_ig65-removebg-preview.png'),
  emptyMailbox:  require('../assets/icons/undraw_empty-mailbox_ef0e-removebg-preview.png'),
  emptyCart:     require('../assets/icons/undraw_empty-cart_574u-removebg-preview.png'),

  // IPA reference (Accent)
  ipaArticulation: require('../assets/icons/IPA_articulation__es_-removebg-preview.png'),
  ipaEuler:        require('../assets/icons/IPA-euler-manners-features.png'),

  // Newly added themed illustrations
  adjustSettings:      require('../assets/icons/undraw_adjust-settings_6pis-removebg-preview.png'),
  adventureMap:        require('../assets/icons/undraw_adventure-map_3e4p-removebg-preview.png'),
  aiChat:              require('../assets/icons/undraw_ai-chat_ljb9-removebg-preview.png'),
  aiResearch:          require('../assets/icons/undraw_ai-research-assistant_cxx0-removebg-preview.png'),
  alarmClock:          require('../assets/icons/undraw_alarm-clock_zgtg-removebg-preview.png'),
  calendar:            require('../assets/icons/undraw_calendar_8r6s-removebg-preview.png'),
  certificate:         require('../assets/icons/undraw_certificate_cqps-removebg-preview.png'),
  chatBot:             require('../assets/icons/undraw_chat-bot_c8iw-removebg-preview.png'),
  contractSigned:      require('../assets/icons/undraw_contract-signed_vutk-removebg-preview.png'),
  conversation:        require('../assets/icons/undraw_conversation_15p8-removebg-preview.png'),
  fillTheBlanks:       require('../assets/icons/undraw_fill-the-blanks_lxuz-removebg-preview.png'),
  firmware:            require('../assets/icons/undraw_firmware_3fxd-removebg-preview.png'),
  largeLanguageModels: require('../assets/icons/undraw_large-language-models_m4no-removebg-preview.png'),
  map:                 require('../assets/icons/undraw_map_cuix-removebg-preview.png'),
  mindMap:             require('../assets/icons/undraw_mind-map_i9bv-removebg-preview.png'),
  onboarding:          require('../assets/icons/undraw_onboarding_dcq2-removebg-preview.png'),
  onlineTest:          require('../assets/icons/undraw_online-test_cqv0-removebg-preview.png'),
  predictiveAnalytics: require('../assets/icons/undraw_predictive-analytics_6gsu-removebg-preview.png'),
  readingNotes:        require('../assets/icons/undraw_reading-notes_dg9z-removebg-preview.png'),
  secureLogin:         require('../assets/icons/undraw_secure-login_m11a-removebg-preview.png'),
  textField:           require('../assets/icons/undraw_text-field_17if-removebg-preview.png'),
  typewriter:          require('../assets/icons/undraw_typewriter_d4km-removebg-preview.png'),
  world:               require('../assets/icons/undraw_world_bdnk-removebg-preview.png'),
} as const;
