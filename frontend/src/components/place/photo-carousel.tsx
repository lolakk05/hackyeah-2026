import { Image } from 'expo-image';
import { useState } from 'react';
import { ScrollView, View, useWindowDimensions } from 'react-native';

import { DuoText } from '@/components/duo/duo-text';
import { themedStyles, useDuo } from '@/state/theme-context';

/** Swipeable photo strip with page dots. */
export function PhotoCarousel({ photos, name, color }: { photos: string[]; name: string; color: string }) {
  const t = useDuo();
  const styles = useStyles();
  const { width: screenWidth } = useWindowDimensions();
  const width = Math.min(screenWidth, 600) - 40;
  const [page, setPage] = useState(0);

  if (photos.length === 0) {
    return (
      <View style={[styles.empty, { width, backgroundColor: t.soft(color) }]}>
        <DuoText variant="body" color={t.textMuted}>
          📷 No photos yet
        </DuoText>
      </View>
    );
  }

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
          <Image
            key={uri}
            source={{ uri }}
            style={[styles.photo, { width, backgroundColor: t.soft(color) }]}
            contentFit="cover"
            transition={200}
            accessibilityLabel={`Photo ${i + 1} of ${photos.length}: ${name}`}
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
    </View>
  );
}

const useStyles = themedStyles((t) => ({
  scroller: { borderRadius: t.radius.lg },
  photo: { height: 220 },
  empty: { height: 140, borderRadius: t.radius.lg, alignItems: 'center', justifyContent: 'center' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 10 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: t.border },
}));
