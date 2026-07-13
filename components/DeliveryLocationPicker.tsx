import React, { useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, StyleSheet, ActivityIndicator,
  Modal, ScrollView, Platform, Linking, Image,
} from 'react-native';
import { MapPin, Navigation, Search, X, Check, ExternalLink, Crosshair } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import type { GpsCoords } from '@/lib/delivery-request-types';

const GOOGLE_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';
const COORD_REGEX = /^(-?\d{1,3}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)$/;

interface Props {
  label: string;
  value: GpsCoords | null;
  onChange: (coords: GpsCoords) => void;
  pinColor?: string;
}

interface Suggestion {
  place_id: string;
  description: string;
  structured_formatting: { main_text: string; secondary_text: string };
}

export default function DeliveryLocationPicker({ label, value, onChange, pinColor }: Props) {
  const { colors, isDark } = useTheme();
  const [modalVisible, setModalVisible] = useState(false);
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [mapCoords, setMapCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [coordInput, setCoordInput] = useState('');
  const [coordError, setCoordError] = useState('');
  const [showCoordPanel, setShowCoordPanel] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const accent = pinColor ?? colors.primary;
  const C = isDark ? '#00e5ff' : '#1A73E8';
  const GREEN = '#10b981';

  const openModal = () => {
    setMapCoords(null);
    setSuggestions([]);
    setShowCoordPanel(false);
    setCoordInput('');
    setCoordError('');
    if (value) {
      setQuery(value.address);
      setMapCoords({ lat: value.lat, lng: value.lng });
    } else {
      setQuery('');
    }
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setMapCoords(null);
    setSuggestions([]);
  };

  const openGoogleMaps = () => {
    const url = value
      ? `https://www.google.com/maps/search/?api=1&query=${value.lat},${value.lng}`
      : `https://www.google.com/maps`;
    if (Platform.OS === 'web') {
      window.open(url, '_blank');
    } else {
      Linking.openURL(url);
    }
  };

  const parseCoordinates = async () => {
    setCoordError('');
    const match = coordInput.trim().match(COORD_REGEX);
    if (!match) {
      setCoordError('Enter coordinates as: -17.829310, 31.052241');
      return;
    }
    const lat = parseFloat(match[1]);
    const lng = parseFloat(match[2]);
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      setCoordError('Coordinates out of valid range');
      return;
    }
    const address = await reverseGeocode(lat, lng);
    onChange({ lat, lng, address });
    setQuery(address);
    setMapCoords({ lat, lng });
    setCoordInput('');
    setShowCoordPanel(false);
  };

  const searchPlaces = (text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (text.trim().length < 3) { setSuggestions([]); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        if (GOOGLE_KEY) {
          const res = await fetch(`https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(text)}&key=${GOOGLE_KEY}&types=geocode&language=en`);
          const json = await res.json();
          setSuggestions(json.predictions ?? []);
        } else {
          const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(text)}&limit=6&addressdetails=1`, { headers: { 'Accept-Language': 'en' } });
          const json = await res.json();
          setSuggestions(json.map((r: any) => ({
            place_id: r.place_id.toString(),
            description: r.display_name,
            structured_formatting: {
              main_text: r.name || r.display_name.split(',')[0],
              secondary_text: r.display_name.split(',').slice(1).join(',').trim(),
            },
          })));
        }
      } catch { setSuggestions([]); }
      setSearching(false);
    }, 400);
  };

  const selectSuggestion = async (suggestion: Suggestion) => {
    setSearching(true);
    setSuggestions([]);
    try {
      let lat = 0; let lng = 0;
      if (GOOGLE_KEY) {
        const res = await fetch(`https://maps.googleapis.com/maps/api/place/details/json?place_id=${suggestion.place_id}&fields=geometry&key=${GOOGLE_KEY}`);
        const json = await res.json();
        lat = json.result?.geometry?.location?.lat ?? 0;
        lng = json.result?.geometry?.location?.lng ?? 0;
      } else {
        const res = await fetch(`https://nominatim.openstreetmap.org/details.php?place_id=${suggestion.place_id}&format=json`);
        const json = await res.json();
        lat = parseFloat(json.centroid?.coordinates?.[1] ?? '0');
        lng = parseFloat(json.centroid?.coordinates?.[0] ?? '0');
      }
      onChange({ lat, lng, address: suggestion.description });
      setMapCoords({ lat, lng });
      setQuery(suggestion.description);
    } catch {}
    setSearching(false);
  };

  const detectCurrentLocation = async () => {
    setDetecting(true);
    try {
      let lat = 0; let lng = 0;
      if (Platform.OS === 'web') {
        const pos = await new Promise<GeolocationPosition>((res, rej) =>
          navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 10000 })
        );
        lat = pos.coords.latitude; lng = pos.coords.longitude;
      } else {
        const Location = require('expo-location');
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') throw new Error('denied');
        const pos = await Location.getCurrentPositionAsync({});
        lat = pos.coords.latitude; lng = pos.coords.longitude;
      }
      const address = await reverseGeocode(lat, lng);
      onChange({ lat, lng, address });
      setQuery(address);
      setMapCoords({ lat, lng });
    } catch {}
    setDetecting(false);
  };

  const reverseGeocode = async (lat: number, lng: number): Promise<string> => {
    try {
      if (GOOGLE_KEY) {
        const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_KEY}`);
        const json = await res.json();
        return json.results?.[0]?.formatted_address ?? `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
      } else {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`, { headers: { 'Accept-Language': 'en' } });
        const json = await res.json();
        return json.display_name ?? `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
      }
    } catch {
      return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    }
  };

  const getStaticMapUrl = (lat: number, lng: number) => {
    // Use OpenStreetMap static tile at zoom 16 — plain image, no iframe
    const z = 16;
    const tileX = Math.floor((lng + 180) / 360 * Math.pow(2, z));
    const latRad = (lat * Math.PI) / 180;
    const tileY = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * Math.pow(2, z));
    return `https://tile.openstreetmap.org/${z}/${tileX}/${tileY}.png`;
  };

  const s = StyleSheet.create({
    trigger: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      padding: 16, borderRadius: 16, borderWidth: 1.5,
      borderColor: value ? accent + '55' : (isDark ? 'rgba(255,255,255,0.1)' : '#cbd5e1'),
      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#f8faff',
    },
    triggerIcon: {
      width: 40, height: 40, borderRadius: 12,
      justifyContent: 'center', alignItems: 'center',
      backgroundColor: value ? (accent + '20') : (isDark ? 'rgba(255,255,255,0.07)' : '#eef2ff'),
    },
    triggerText: { flex: 1 },
    triggerLabel: { fontSize: 11, fontWeight: '700', color: isDark ? '#8296b0' : '#64748b', letterSpacing: 1, textTransform: 'uppercase' as any },
    triggerValue: { fontSize: 14, fontWeight: '600', color: value ? colors.text : colors.placeholder, marginTop: 2 },
    modal: { flex: 1, backgroundColor: isDark ? '#070f1c' : '#f0f4f8' },
    modalHeader: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      paddingHorizontal: 20,
      paddingTop: Platform.OS === 'ios' ? 56 : (Platform.OS === 'web' ? 20 : 44),
      paddingBottom: 16,
      backgroundColor: isDark ? '#070f1c' : '#fff',
      borderBottomWidth: 1, borderBottomColor: isDark ? 'rgba(0,229,255,0.1)' : '#e2e8f0',
    },
    modalBack: {
      width: 38, height: 38, borderRadius: 11, justifyContent: 'center', alignItems: 'center',
      backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : '#f0f4f8',
    },
    modalTitle: { flex: 1, fontSize: 17, fontWeight: '800', color: colors.text },
    sectionLabel: {
      marginHorizontal: 16, marginTop: 18, marginBottom: 8,
      fontSize: 10, fontWeight: '800', letterSpacing: 1.5,
      color: isDark ? '#3a5a7a' : '#94a3b8', textTransform: 'uppercase' as any,
    },
    searchRow: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      marginHorizontal: 16, marginTop: 14, marginBottom: 6,
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#fff',
      borderWidth: 1.5, borderColor: isDark ? 'rgba(0,229,255,0.2)' : '#cbd5e1',
      borderRadius: 14, paddingHorizontal: 14, height: 50,
    },
    searchInput: {
      flex: 1, fontSize: 15, color: colors.text,
      ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}),
    },
    suggestionItem: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      paddingHorizontal: 20, paddingVertical: 14,
      borderBottomWidth: 1, borderBottomColor: isDark ? 'rgba(255,255,255,0.05)' : '#f0f4f8',
    },
    suggestionMain: { fontSize: 14, fontWeight: '600', color: colors.text },
    suggestionSub: { fontSize: 12, color: colors.textTertiary, marginTop: 1 },
    optionBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      marginHorizontal: 16, marginTop: 8,
      paddingHorizontal: 16, paddingVertical: 13,
      borderRadius: 14, borderWidth: 1,
    },
    optionBtnText: { flex: 1, fontSize: 14, fontWeight: '700' },
    detectBtn: {
      borderColor: isDark ? 'rgba(0,229,255,0.3)' : 'rgba(26,115,232,0.2)',
      backgroundColor: isDark ? 'rgba(0,229,255,0.07)' : 'rgba(26,115,232,0.05)',
    },
    gmapsBtn: {
      borderColor: isDark ? 'rgba(66,133,244,0.4)' : 'rgba(66,133,244,0.3)',
      backgroundColor: isDark ? 'rgba(66,133,244,0.08)' : 'rgba(66,133,244,0.05)',
    },
    coordToggleBtn: {
      borderColor: isDark ? 'rgba(16,185,129,0.35)' : 'rgba(16,185,129,0.25)',
      backgroundColor: isDark ? 'rgba(16,185,129,0.07)' : 'rgba(16,185,129,0.04)',
    },
    coordPanel: {
      marginHorizontal: 16, marginTop: 10,
      backgroundColor: isDark ? 'rgba(16,185,129,0.06)' : 'rgba(16,185,129,0.04)',
      borderRadius: 16, borderWidth: 1,
      borderColor: isDark ? 'rgba(16,185,129,0.25)' : 'rgba(16,185,129,0.2)',
      padding: 16,
    },
    coordPanelTitle: { fontSize: 13, fontWeight: '800', color: GREEN, marginBottom: 6 },
    coordPanelHint: { fontSize: 12, color: isDark ? '#4a7a5a' : '#5a9a7a', marginBottom: 12, lineHeight: 17 },
    coordInputRow: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      backgroundColor: isDark ? 'rgba(0,0,0,0.3)' : '#fff',
      borderRadius: 12, borderWidth: 1,
      borderColor: isDark ? 'rgba(16,185,129,0.3)' : 'rgba(16,185,129,0.25)',
      paddingHorizontal: 14, height: 48,
    },
    coordInputField: {
      flex: 1, fontSize: 14, color: colors.text,
      ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}),
    },
    coordParseBtn: {
      backgroundColor: GREEN, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8,
    },
    coordParseBtnText: { fontSize: 13, fontWeight: '800', color: '#fff' },
    coordError: { fontSize: 12, color: '#ef4444', marginTop: 8 },
    guideBox: {
      marginTop: 10,
      backgroundColor: isDark ? 'rgba(66,133,244,0.07)' : 'rgba(66,133,244,0.05)',
      borderRadius: 12, borderWidth: 1,
      borderColor: isDark ? 'rgba(66,133,244,0.2)' : 'rgba(66,133,244,0.15)',
      padding: 12,
    },
    guideText: { fontSize: 12, color: isDark ? '#7aa3cc' : '#5a7a9a', lineHeight: 18 },
    guideStep: { fontSize: 12, color: '#4285F4', fontWeight: '700' },
    mapWrap: {
      marginHorizontal: 16, marginTop: 14, borderRadius: 16, overflow: 'hidden',
      height: 220, borderWidth: 1,
      borderColor: isDark ? 'rgba(0,229,255,0.15)' : '#e2e8f0',
      position: 'relative' as any,
    },
    mapPinOverlay: {
      position: 'absolute' as any, top: 0, left: 0, right: 0, bottom: 0,
      justifyContent: 'center', alignItems: 'center',
      pointerEvents: 'none' as any,
    },
    mapOpenBtn: {
      position: 'absolute' as any, bottom: 8, right: 8,
      flexDirection: 'row', alignItems: 'center', gap: 5,
      backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 10, paddingVertical: 6,
      borderRadius: 8,
    },
    mapOpenBtnText: { fontSize: 11, fontWeight: '700', color: '#fff' },
    confirmedRow: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      marginHorizontal: 16, marginTop: 10, padding: 12, borderRadius: 12,
      backgroundColor: isDark ? 'rgba(0,255,136,0.07)' : '#f0fdf9',
      borderWidth: 1, borderColor: isDark ? 'rgba(0,255,136,0.2)' : '#a7f3d0',
    },
    confirmedText: { flex: 1, fontSize: 12, color: GREEN, fontWeight: '600' },
    confirmedCoords: { fontSize: 11, color: isDark ? '#3a8a5a' : '#5a9a7a', marginTop: 2 },
    confirmBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      marginHorizontal: 16, marginTop: 16, marginBottom: 24,
      height: 52, borderRadius: 16,
      shadowColor: accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
    },
    confirmBtnText: { fontSize: 16, fontWeight: '800', color: '#fff', letterSpacing: 0.3 },
  });

  return (
    <>
      {/* Trigger button — no iframe, no monospace fonts, no map content */}
      <TouchableOpacity style={s.trigger} onPress={openModal} activeOpacity={0.75}>
        <View style={s.triggerIcon}>
          <MapPin size={20} color={value ? accent : colors.textTertiary} />
        </View>
        <View style={s.triggerText}>
          <Text style={s.triggerLabel}>{label}</Text>
          <Text style={s.triggerValue} numberOfLines={2}>
            {value ? value.address : 'Tap to set location'}
          </Text>
        </View>
        {value && <Check size={18} color={GREEN} />}
      </TouchableOpacity>

      <Modal visible={modalVisible} animationType="slide" onRequestClose={closeModal}>
        <View style={s.modal}>
          <View style={s.modalHeader}>
            <TouchableOpacity style={s.modalBack} onPress={closeModal}>
              <X size={18} color={colors.text} />
            </TouchableOpacity>
            <Text style={s.modalTitle}>Set {label}</Text>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={s.sectionLabel}>Search by name or address</Text>
            <View style={s.searchRow}>
              <Search size={18} color={colors.placeholder} />
              <TextInput
                style={s.searchInput}
                value={query}
                onChangeText={searchPlaces}
                placeholder="Search address or landmark..."
                placeholderTextColor={colors.placeholder}
                autoFocus
              />
              {searching
                ? <ActivityIndicator size="small" color={accent} />
                : query.length > 0
                  ? <TouchableOpacity onPress={() => { setQuery(''); setSuggestions([]); }}>
                      <X size={16} color={colors.textTertiary} />
                    </TouchableOpacity>
                  : null}
            </View>

            {suggestions.map(s_ => (
              <TouchableOpacity key={s_.place_id} style={s.suggestionItem} onPress={() => selectSuggestion(s_)} activeOpacity={0.7}>
                <MapPin size={16} color={accent} />
                <View style={{ flex: 1 }}>
                  <Text style={s.suggestionMain}>{s_.structured_formatting.main_text}</Text>
                  <Text style={s.suggestionSub} numberOfLines={1}>{s_.structured_formatting.secondary_text}</Text>
                </View>
              </TouchableOpacity>
            ))}

            <Text style={s.sectionLabel}>Other options</Text>

            <TouchableOpacity style={[s.optionBtn, s.detectBtn]} onPress={detectCurrentLocation} activeOpacity={0.8}>
              {detecting
                ? <ActivityIndicator size="small" color={C} />
                : <Navigation size={18} color={C} />}
              <Text style={[s.optionBtnText, { color: C }]}>{detecting ? 'Detecting location...' : 'Use my current location'}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[s.optionBtn, s.gmapsBtn]} onPress={openGoogleMaps} activeOpacity={0.8}>
              <ExternalLink size={18} color="#4285F4" />
              <View style={{ flex: 1 }}>
                <Text style={[s.optionBtnText, { color: '#4285F4', flex: 0 }]}>Open Google Maps to find coordinates</Text>
                <Text style={{ fontSize: 11, color: isDark ? '#4a6a9a' : '#8aa0c0', marginTop: 2 }}>Right-click a spot → copy coordinates → paste below</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.optionBtn, s.coordToggleBtn]}
              onPress={() => { setShowCoordPanel(p => !p); setCoordError(''); }}
              activeOpacity={0.8}
            >
              <Crosshair size={18} color={GREEN} />
              <Text style={[s.optionBtnText, { color: GREEN }]}>Paste coordinates manually</Text>
              <Text style={{ fontSize: 18, color: GREEN, fontWeight: '300' }}>{showCoordPanel ? '−' : '+'}</Text>
            </TouchableOpacity>

            {showCoordPanel && (
              <View style={s.coordPanel}>
                <Text style={s.coordPanelTitle}>Paste GPS Coordinates</Text>
                <Text style={s.coordPanelHint}>
                  Format: latitude, longitude{'\n'}
                  Example: -17.829310, 31.052241
                </Text>
                <View style={s.coordInputRow}>
                  <Crosshair size={16} color={GREEN} />
                  <TextInput
                    style={s.coordInputField}
                    value={coordInput}
                    onChangeText={t => { setCoordInput(t); setCoordError(''); }}
                    placeholder="-17.829310, 31.052241"
                    placeholderTextColor={isDark ? '#2a5a3a' : '#9ab0a0'}
                    keyboardType="default"
                    autoCapitalize="none"
                    autoCorrect={false}
                    onSubmitEditing={parseCoordinates}
                  />
                  <TouchableOpacity style={s.coordParseBtn} onPress={parseCoordinates} activeOpacity={0.85}>
                    <Text style={s.coordParseBtnText}>Set</Text>
                  </TouchableOpacity>
                </View>
                {coordError ? <Text style={s.coordError}>{coordError}</Text> : null}
                <View style={s.guideBox}>
                  <Text style={s.guideText}>
                    <Text style={s.guideStep}>How to get coordinates from Google Maps:{'\n'}</Text>
                    1. Tap "Open Google Maps" above{'\n'}
                    2. Navigate to the location{'\n'}
                    3. Right-click (desktop) or long-press (mobile) on the exact spot{'\n'}
                    4. The coordinates appear at the top — tap to copy{'\n'}
                    5. Come back and paste them here
                  </Text>
                </View>
              </View>
            )}

            {/* Map preview — static tile image, no iframe, no bleed */}
            {mapCoords ? (
              <View style={s.mapWrap}>
                <Image
                  source={{ uri: getStaticMapUrl(mapCoords.lat, mapCoords.lng) }}
                  style={{ width: '100%', height: '100%' }}
                  resizeMode="cover"
                />
                {/* Pin overlay */}
                <View style={s.mapPinOverlay}>
                  <MapPin size={32} color={accent} strokeWidth={2.5} />
                </View>
                {/* "Open in Maps" shortcut */}
                <TouchableOpacity style={s.mapOpenBtn} onPress={openGoogleMaps} activeOpacity={0.85}>
                  <ExternalLink size={13} color="#fff" />
                  <Text style={s.mapOpenBtnText}>Open in Maps</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {value && (
              <View style={s.confirmedRow}>
                <Check size={16} color={GREEN} />
                <View style={{ flex: 1 }}>
                  <Text style={s.confirmedText} numberOfLines={2}>{value.address}</Text>
                  <Text style={s.confirmedCoords}>{value.lat.toFixed(6)}, {value.lng.toFixed(6)}</Text>
                </View>
              </View>
            )}

            {value && (
              <TouchableOpacity
                style={[s.confirmBtn, { backgroundColor: accent }]}
                onPress={closeModal}
                activeOpacity={0.85}
              >
                <Check size={20} color="#fff" />
                <Text style={s.confirmBtnText}>Confirm Location</Text>
              </TouchableOpacity>
            )}

            <View style={{ height: 16 }} />
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}
