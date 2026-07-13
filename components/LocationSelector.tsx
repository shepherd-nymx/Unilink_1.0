import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  TextInput,
  ScrollView,
  Platform,
} from 'react-native';
import * as Location from 'expo-location';
import { MapPin, Navigation, CircleAlert as AlertCircle, CreditCard as Edit2, CircleCheck as CheckCircle, X } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';

type LocationData = {
  latitude: number;
  longitude: number;
  address?: string;
  source: 'saved' | 'current' | 'manual';
};

type LocationSelectorProps = {
  visible: boolean;
  onClose: () => void;
  onLocationConfirm: (location: LocationData) => void;
  savedLocation?: { latitude: number; longitude: number; address?: string } | null;
  customerName?: string;
};

export default function LocationSelector({
  visible,
  onClose,
  onLocationConfirm,
  savedLocation,
  customerName,
}: LocationSelectorProps) {
  const { colors } = useTheme();
  const [selectedLocation, setSelectedLocation] = useState<LocationData | null>(null);
  const [loadingCurrentLocation, setLoadingCurrentLocation] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualAddress, setManualAddress] = useState('');
  const [manualLatitude, setManualLatitude] = useState('');
  const [manualLongitude, setManualLongitude] = useState('');

  useEffect(() => {
    if (visible && savedLocation) {
      setSelectedLocation({
        latitude: savedLocation.latitude,
        longitude: savedLocation.longitude,
        address: savedLocation.address || 'Saved registration address',
        source: 'saved',
      });
    }
  }, [visible, savedLocation]);

  const handleUseSavedAddress = () => {
    if (!savedLocation) return;

    setSelectedLocation({
      latitude: savedLocation.latitude,
      longitude: savedLocation.longitude,
      address: savedLocation.address || 'Saved registration address',
      source: 'saved',
    });
    setLocationError('');
    setShowManualEntry(false);
  };

  const handleUseCurrentLocation = async () => {
    setLoadingCurrentLocation(true);
    setLocationError('');

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== 'granted') {
        setLocationError(
          'Location permission denied. Please enable location access in your device settings or enter your address manually below.'
        );
        setShowManualEntry(true);
        setLoadingCurrentLocation(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      let address = 'Current GPS location';

      try {
        const geocoded = await Location.reverseGeocodeAsync({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });

        if (geocoded && geocoded.length > 0) {
          const result = geocoded[0];
          const addressParts = [
            result.street,
            result.city,
            result.region,
            result.country,
          ].filter(Boolean);

          if (addressParts.length > 0) {
            address = addressParts.join(', ');
          }
        }
      } catch (geocodeError) {
        console.log('Geocoding failed, using coordinates only');
      }

      setSelectedLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        address,
        source: 'current',
      });
      setShowManualEntry(false);
    } catch (err: any) {
      console.error('Location error:', err);
      setLocationError('Failed to get your location. Please try again or enter manually.');
      setShowManualEntry(true);
    } finally {
      setLoadingCurrentLocation(false);
    }
  };

  const handleManualEntry = () => {
    const lat = parseFloat(manualLatitude);
    const lon = parseFloat(manualLongitude);

    if (isNaN(lat) || isNaN(lon)) {
      setLocationError('Please enter valid coordinates');
      return;
    }

    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      setLocationError('Coordinates out of range. Latitude: -90 to 90, Longitude: -180 to 180');
      return;
    }

    setSelectedLocation({
      latitude: lat,
      longitude: lon,
      address: manualAddress.trim() || `Manual entry: ${lat.toFixed(6)}, ${lon.toFixed(6)}`,
      source: 'manual',
    });
    setLocationError('');
  };

  const handleConfirm = () => {
    if (!selectedLocation) {
      setLocationError('Please select a delivery location');
      return;
    }

    onLocationConfirm(selectedLocation);
    onClose();
  };

  const handleCancel = () => {
    setSelectedLocation(null);
    setLocationError('');
    setShowManualEntry(false);
    setManualAddress('');
    setManualLatitude('');
    setManualLongitude('');
    onClose();
  };

  const styles = StyleSheet.create({
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    modalContent: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      width: '100%',
      maxWidth: 500,
      maxHeight: '90%',
      overflow: 'hidden',
    },
    modalHeader: {
      padding: 24,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
      backgroundColor: colors.background,
    },
    modalTitle: {
      fontSize: 24,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 8,
    },
    modalSubtitle: {
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 20,
    },
    scrollContent: {
      padding: 20,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 16,
    },
    locationOption: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      padding: 16,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: colors.borderLight,
      backgroundColor: colors.surface,
      marginBottom: 12,
      gap: 12,
    },
    locationOptionActive: {
      borderColor: colors.primary,
      backgroundColor: colors.infoLight,
    },
    locationIconContainer: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.background,
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 2,
    },
    locationIconContainerActive: {
      backgroundColor: colors.primary + '20',
    },
    locationContent: {
      flex: 1,
    },
    locationTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 4,
    },
    locationDescription: {
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 20,
    },
    selectedBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginTop: 8,
      paddingHorizontal: 10,
      paddingVertical: 4,
      backgroundColor: colors.successLight,
      borderRadius: 12,
      alignSelf: 'flex-start',
    },
    selectedBadgeText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.success,
    },
    errorContainer: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      padding: 16,
      backgroundColor: colors.errorLight,
      borderRadius: 12,
      marginBottom: 16,
    },
    errorText: {
      flex: 1,
      fontSize: 14,
      color: colors.error,
      lineHeight: 20,
    },
    manualEntrySection: {
      backgroundColor: colors.background,
      padding: 16,
      borderRadius: 12,
      marginTop: 8,
      gap: 12,
    },
    manualEntryTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 4,
    },
    input: {
      backgroundColor: colors.input,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      borderRadius: 8,
      padding: 12,
      fontSize: 15,
      color: colors.text,
    },
    inputRow: {
      flexDirection: 'row',
      gap: 12,
    },
    inputHalf: {
      flex: 1,
    },
    inputLabel: {
      fontSize: 13,
      fontWeight: '500',
      color: colors.textSecondary,
      marginBottom: 6,
    },
    inputHint: {
      fontSize: 12,
      color: colors.textTertiary,
      marginTop: 4,
      fontStyle: 'italic',
    },
    applyButton: {
      backgroundColor: colors.primary,
      padding: 12,
      borderRadius: 8,
      alignItems: 'center',
      marginTop: 8,
    },
    applyButtonText: {
      color: colors.surface,
      fontSize: 14,
      fontWeight: '600',
    },
    confirmationBox: {
      backgroundColor: colors.successLight,
      padding: 16,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: colors.success,
      marginBottom: 16,
    },
    confirmationTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.success,
      marginBottom: 8,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    confirmationText: {
      fontSize: 14,
      color: colors.success,
      lineHeight: 20,
    },
    coordinatesText: {
      fontSize: 12,
      color: colors.success,
      marginTop: 6,
      fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    },
    editButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 8,
      paddingHorizontal: 12,
      backgroundColor: colors.surface,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.primary,
      marginTop: 12,
      alignSelf: 'flex-start',
    },
    editButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.primary,
    },
    modalActions: {
      flexDirection: 'row',
      gap: 12,
      padding: 20,
      borderTopWidth: 1,
      borderTopColor: colors.borderLight,
      backgroundColor: colors.background,
    },
    actionButton: {
      flex: 1,
      padding: 16,
      borderRadius: 12,
      alignItems: 'center',
    },
    cancelButton: {
      backgroundColor: colors.surface,
      borderWidth: 2,
      borderColor: colors.border,
    },
    confirmButton: {
      backgroundColor: colors.primary,
    },
    confirmButtonDisabled: {
      opacity: 0.5,
    },
    actionButtonText: {
      fontSize: 16,
      fontWeight: '600',
    },
    cancelButtonText: {
      color: colors.textSecondary,
    },
    confirmButtonText: {
      color: colors.surface,
    },
    loadingContainer: {
      padding: 20,
      alignItems: 'center',
    },
    loadingText: {
      marginTop: 12,
      fontSize: 14,
      color: colors.textSecondary,
    },
  });

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleCancel}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Confirm Delivery Location</Text>
            <Text style={styles.modalSubtitle}>
              Choose your delivery location to ensure accurate delivery
            </Text>
          </View>

          <ScrollView style={{ flex: 1 }}>
            <View style={styles.scrollContent}>
              {locationError ? (
                <View style={styles.errorContainer}>
                  <AlertCircle size={20} color={colors.error} />
                  <Text style={styles.errorText}>{locationError}</Text>
                </View>
              ) : null}

              {selectedLocation ? (
                <View style={styles.confirmationBox}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <CheckCircle size={20} color={colors.success} />
                    <Text style={styles.confirmationTitle}>Location Selected</Text>
                  </View>
                  <Text style={styles.confirmationText}>
                    {selectedLocation.address}
                  </Text>
                  <Text style={styles.coordinatesText}>
                    {selectedLocation.latitude.toFixed(6)}, {selectedLocation.longitude.toFixed(6)}
                  </Text>
                  <TouchableOpacity
                    style={styles.editButton}
                    onPress={() => setSelectedLocation(null)}
                  >
                    <Edit2 size={16} color={colors.primary} />
                    <Text style={styles.editButtonText}>Change Location</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <Text style={styles.sectionTitle}>Select Delivery Location:</Text>

                  {savedLocation && (
                    <TouchableOpacity
                      style={[
                        styles.locationOption,
                        selectedLocation?.source === 'saved' && styles.locationOptionActive,
                      ]}
                      onPress={handleUseSavedAddress}
                    >
                      <View style={[
                        styles.locationIconContainer,
                        selectedLocation?.source === 'saved' && styles.locationIconContainerActive,
                      ]}>
                        <MapPin
                          size={24}
                          color={selectedLocation?.source === 'saved' ? colors.primary : colors.textTertiary}
                        />
                      </View>
                      <View style={styles.locationContent}>
                        <Text style={styles.locationTitle}>Saved Address</Text>
                        <Text style={styles.locationDescription}>
                          Use your address from registration
                        </Text>
                        {selectedLocation?.source === 'saved' && (
                          <View style={styles.selectedBadge}>
                            <CheckCircle size={14} color={colors.success} />
                            <Text style={styles.selectedBadgeText}>Selected</Text>
                          </View>
                        )}
                      </View>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    style={[
                      styles.locationOption,
                      selectedLocation?.source === 'current' && styles.locationOptionActive,
                    ]}
                    onPress={handleUseCurrentLocation}
                    disabled={loadingCurrentLocation}
                  >
                    <View style={[
                      styles.locationIconContainer,
                      selectedLocation?.source === 'current' && styles.locationIconContainerActive,
                    ]}>
                      <Navigation
                        size={24}
                        color={selectedLocation?.source === 'current' ? colors.primary : colors.textTertiary}
                      />
                    </View>
                    <View style={styles.locationContent}>
                      <Text style={styles.locationTitle}>Current Location</Text>
                      <Text style={styles.locationDescription}>
                        Use your real-time GPS location
                      </Text>
                      {loadingCurrentLocation && (
                        <View style={styles.loadingContainer}>
                          <ActivityIndicator size="small" color={colors.primary} />
                          <Text style={styles.loadingText}>Getting your location...</Text>
                        </View>
                      )}
                      {selectedLocation?.source === 'current' && !loadingCurrentLocation && (
                        <View style={styles.selectedBadge}>
                          <CheckCircle size={14} color={colors.success} />
                          <Text style={styles.selectedBadgeText}>Selected</Text>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>

                  {showManualEntry && (
                    <View style={styles.manualEntrySection}>
                      <Text style={styles.manualEntryTitle}>Manual Address Entry</Text>

                      <View>
                        <Text style={styles.inputLabel}>Address Description</Text>
                        <TextInput
                          style={styles.input}
                          value={manualAddress}
                          onChangeText={setManualAddress}
                          placeholder="e.g., Room 5, Building A, Campus"
                          placeholderTextColor={colors.placeholder}
                        />
                      </View>

                      <View style={styles.inputRow}>
                        <View style={styles.inputHalf}>
                          <Text style={styles.inputLabel}>Latitude</Text>
                          <TextInput
                            style={styles.input}
                            value={manualLatitude}
                            onChangeText={setManualLatitude}
                            placeholder="-17.8252"
                            keyboardType="numeric"
                            placeholderTextColor={colors.placeholder}
                          />
                        </View>
                        <View style={styles.inputHalf}>
                          <Text style={styles.inputLabel}>Longitude</Text>
                          <TextInput
                            style={styles.input}
                            value={manualLongitude}
                            onChangeText={setManualLongitude}
                            placeholder="31.0335"
                            keyboardType="numeric"
                            placeholderTextColor={colors.placeholder}
                          />
                        </View>
                      </View>

                      <Text style={styles.inputHint}>
                        Get coordinates from Google Maps by long-pressing on a location
                      </Text>

                      <TouchableOpacity
                        style={styles.applyButton}
                        onPress={handleManualEntry}
                      >
                        <Text style={styles.applyButtonText}>Apply Manual Location</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </>
              )}
            </View>
          </ScrollView>

          <View style={styles.modalActions}>
            <TouchableOpacity
              style={[styles.actionButton, styles.cancelButton]}
              onPress={handleCancel}
            >
              <Text style={[styles.actionButtonText, styles.cancelButtonText]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.actionButton,
                styles.confirmButton,
                !selectedLocation && styles.confirmButtonDisabled,
              ]}
              onPress={handleConfirm}
              disabled={!selectedLocation}
            >
              <Text style={[styles.actionButtonText, styles.confirmButtonText]}>
                Confirm Location
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
