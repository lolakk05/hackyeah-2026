import { Image } from 'expo-image';
import { useState } from 'react';
import { ScrollView, View, useWindowDimensions, type StyleProp, type ImageStyle } from 'react-native';

import { alternatePhotoUrl } from '@/api/photos';
import { DuoText } from '@/components/duo/duo-text';

import { useI18n } from '@/i18n/language-context';
import { themedStyles, useDuo } from '@/state/theme-context';

/** Swipeable photo strip with page dots and the photo's author / licence. */
export function PhotoCarousel({
  photos,
  name,
  color,
  credits,
}: {
  photos: string[];
  name: string;
  color: string;
  /** Author and licence for each photo (same order). */
  credits?: string[];
}) {
  const t = useDuo();
  const styles = useStyles();
  const { s, fmt } = useI18n();
  const { width: screenWidth } = useWindowDimensions();
  const width = Math.min(screenWidth, 600) - 40;
  const [page, setPage] = useState(0);

  if (photos.length === 0) return null;

  return (
    <View>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        style={[styles.scroller, { width }]}
        onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
        onScroll={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
        scrollEventThrottle={64}>
        {photos.map((uri, i) => (
          <Photo
            key={uri}
            uri={uri}
            style={[styles.photo, { width, backgroundColor: t.soft(color) }]}
            label={fmt(s.place.photo, { n: i + 1, total: photos.length, name })}
          />
        ))}
      </ScrollView>
      {photos.length > 1 ? (
        <View style={styles.dots}>
          {photos.map((uri, i) => (
            <View key={uri} style={[styles.dot, i === page && { backgroundColor: color, width: 22 }]} />
          ))}
        </View>
      ) : null}
      {credits?.[page] ? (
        <DuoText variant="caption" color={t.lockedText} numberOfLines={1} style={styles.credit}>
          📷 {credits[page]}
        </DuoText>
      ) : null}
    </View>
  );
}

/** One photo; if it fails to load, tries the other Wikimedia image server once. */
function Photo({ uri, style, label }: { uri: string; style: StyleProp<ImageStyle>; label: string }) {
  const [src, setSrc] = useState(uri);
  return (
    <Image
      source={{ uri: src }}
      style={style}
      contentFit="cover"
      transition={200}
      accessibilityLabel={label}
      onError={() => {
        const other = alternatePhotoUrl(uri);
        if (other && src !== other) setSrc(other);
      }}
    />
  );
}

const useStyles = themedStyles((t) => ({
  scroller: { borderRadius: t.radius.xl },
  photo: { height: 220 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 10 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: t.border },
  credit: { marginTop: 6, fontSize: 11, textAlign: 'center' as const },
}));
