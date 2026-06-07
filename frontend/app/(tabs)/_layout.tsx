import { Slot } from 'expo-router';
import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Dimensions } from 'react-native';
import SidebarMenu from '@/components/sidebar-menu';

const { width } = Dimensions.get('window');

export default function TabLayout() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <View style={styles.container}>
      {/* Hamburger Button */}
      <View style={styles.headerBar}>
        <TouchableOpacity 
          style={styles.hamburgerBtn}
          onPress={() => setMenuOpen(!menuOpen)}
        >
          <Text style={styles.hamburgerIcon}>☰</Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <View style={styles.contentContainer}>
        <Slot />
      </View>

      {/* Overlay Menu */}
      {menuOpen && (
        <View style={styles.overlay}>
          <SidebarMenu onClose={() => setMenuOpen(false)} />
          <TouchableOpacity 
            style={styles.closeArea}
            onPress={() => setMenuOpen(false)}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#060D1A',
  },
  headerBar: {
    height: 70,
    backgroundColor: '#060D1A',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'flex-end',
    paddingLeft: 16,
    paddingBottom: 12,
  },
  hamburgerBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  hamburgerIcon: {
    fontSize: 24,
    color: '#F0F6FF',
  },
  contentContainer: {
    flex: 1,
    backgroundColor: '#060D1A',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    zIndex: 1000,
  },
  closeArea: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
});
