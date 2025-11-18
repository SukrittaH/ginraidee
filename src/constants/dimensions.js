import { Dimensions } from 'react-native';

const { width } = Dimensions.get('window');
export const cardWidth = (width - 48) / 2; // 2 cards per row with margins