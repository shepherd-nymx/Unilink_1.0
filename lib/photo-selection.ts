import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

// Android's system photo picker grants access only to the selected image.
export async function requestPhotoSelectionPermission() {
 if (Platform.OS === 'android') return { status: 'granted' as const, granted: true };
 return ImagePicker.requestMediaLibraryPermissionsAsync();
}
