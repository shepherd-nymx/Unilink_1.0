import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { A } from '@/lib/admin-theme';
import { ArrowLeft, Star, Trash2, Search, X, TriangleAlert as AlertTriangle } from 'lucide-react-native';

type Review = {
  id: string;
  rating: number;
  review_text: string | null;
  created_at: string;
  driver_id: string;
  customer_id: string;
  drivers: { full_name: string } | null;
  customers: { full_name: string } | null;
};

function StarRow({ rating, size = 13 }: { rating: number; size?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4, 5].map(s => (
        <Star
          key={s}
          size={size}
          color={s <= rating ? '#FFD700' : A.textMuted}
          fill={s <= rating ? '#FFD700' : 'transparent'}
        />
      ))}
    </View>
  );
}

export default function AdminReviews() {
  const router = useRouter();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [filtered, setFiltered] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Review | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadReviews();
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, []);

  useEffect(() => {
    const q = search.toLowerCase();
    if (!q) {
      setFiltered(reviews);
      return;
    }
    setFiltered(reviews.filter(r =>
      r.drivers?.full_name?.toLowerCase().includes(q) ||
      r.customers?.full_name?.toLowerCase().includes(q) ||
      r.review_text?.toLowerCase().includes(q)
    ));
  }, [search, reviews]);

  const loadReviews = async () => {
    try {
      const { data, error } = await supabase
        .from('driver_ratings')
        .select(`
          id,
          rating,
          review_text,
          created_at,
          driver_id,
          customer_id,
          drivers:driver_id (full_name),
          customers:customer_id (full_name)
        `)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setReviews(data as any || []);
    } catch (err) {
      console.error('Error loading reviews:', err);
    } finally {
      setLoading(false);
    }
  };

  const deleteReview = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { error } = await supabase
        .from('driver_ratings')
        .delete()
        .eq('id', deleteTarget.id);
      if (error) throw error;
      setReviews(prev => prev.filter(r => r.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      console.error('Error deleting review:', err);
    } finally {
      setDeleting(false);
    }
  };

  const formatDate = (ts: string) =>
    new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const ratingColor = (r: number) => r >= 4 ? A.green : r >= 3 ? A.amber : A.red;

  return (
    <View style={{ flex: 1, backgroundColor: A.bg }}>
      <View style={{
        backgroundColor: A.surface,
        paddingTop: 56,
        paddingBottom: 16,
        paddingHorizontal: 20,
        borderBottomWidth: 1,
        borderBottomColor: A.border,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
      }}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{
            width: 38, height: 38, borderRadius: 10,
            backgroundColor: A.cyanDim, borderWidth: 1, borderColor: A.cyan + '44',
            justifyContent: 'center', alignItems: 'center',
          }}
        >
          <ArrowLeft size={18} color={A.cyan} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 2, color: A.textMuted }}>MODERATION</Text>
          <Text style={{ fontSize: 22, fontWeight: '800', color: A.text }}>Reviews</Text>
        </View>
        <View style={{
          paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
          backgroundColor: A.cyanDim, borderWidth: 1, borderColor: A.cyan + '33',
        }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: A.cyan }}>{filtered.length}</Text>
        </View>
      </View>

      <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4 }}>
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: 10,
          backgroundColor: A.card, borderRadius: 12, borderWidth: 1, borderColor: A.border,
          paddingHorizontal: 14, paddingVertical: 10,
        }}>
          <Search size={15} color={A.textSub} />
          <TextInput
            style={{ flex: 1, fontSize: 14, color: A.text }}
            placeholder="Search by driver, customer, or review..."
            placeholderTextColor={A.textMuted}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <X size={14} color={A.textSub} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 }}>
          <ActivityIndicator size="large" color={A.cyan} />
          <Text style={{ color: A.textSub, fontSize: 13 }}>Loading reviews...</Text>
        </View>
      ) : filtered.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, paddingHorizontal: 40 }}>
          <View style={{
            width: 72, height: 72, borderRadius: 36,
            backgroundColor: A.cyanDim, borderWidth: 1, borderColor: A.border,
            justifyContent: 'center', alignItems: 'center',
          }}>
            <Star size={30} color={A.cyan} />
          </View>
          <Text style={{ fontSize: 16, fontWeight: '700', color: A.textSub }}>No reviews found</Text>
          {search.length > 0 && (
            <Text style={{ fontSize: 13, color: A.textMuted, textAlign: 'center' }}>Try a different search term</Text>
          )}
        </View>
      ) : (
        <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 16, paddingTop: 12, gap: 10 }}
            showsVerticalScrollIndicator={false}
          >
            {filtered.map(review => (
              <View
                key={review.id}
                style={{
                  backgroundColor: A.card,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: A.border,
                  padding: 14,
                  gap: 10,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                  <View style={{ flex: 1, gap: 4 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <View style={{
                        paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
                        backgroundColor: A.cyanDim, borderWidth: 1, borderColor: A.cyan + '33',
                      }}>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: A.cyan }}>DRIVER</Text>
                      </View>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: A.text }}>
                        {review.drivers?.full_name ?? 'Unknown'}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <View style={{
                        paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
                        backgroundColor: A.greenDim, borderWidth: 1, borderColor: A.green + '33',
                      }}>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: A.green }}>CUSTOMER</Text>
                      </View>
                      <Text style={{ fontSize: 13, color: A.textSub }}>
                        {review.customers?.full_name ?? 'Unknown'}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={() => setDeleteTarget(review)}
                    style={{
                      width: 36, height: 36, borderRadius: 8,
                      backgroundColor: A.redDim, borderWidth: 1, borderColor: A.red + '44',
                      justifyContent: 'center', alignItems: 'center',
                    }}
                    activeOpacity={0.8}
                  >
                    <Trash2 size={15} color={A.red} />
                  </TouchableOpacity>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <StarRow rating={review.rating} />
                  <View style={{
                    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6,
                    backgroundColor: ratingColor(review.rating) + '22',
                    borderWidth: 1, borderColor: ratingColor(review.rating) + '44',
                  }}>
                    <Text style={{ fontSize: 12, fontWeight: '800', color: ratingColor(review.rating) }}>
                      {review.rating}/5
                    </Text>
                  </View>
                  <Text style={{ fontSize: 11, color: A.textMuted, marginLeft: 'auto' as any }}>
                    {formatDate(review.created_at)}
                  </Text>
                </View>

                {review.review_text ? (
                  <View style={{
                    backgroundColor: A.surface, borderRadius: 8,
                    borderWidth: 1, borderColor: A.border,
                    padding: 10,
                  }}>
                    <Text style={{ fontSize: 13, color: A.textSub, lineHeight: 20 }}>
                      "{review.review_text}"
                    </Text>
                  </View>
                ) : (
                  <Text style={{ fontSize: 12, color: A.textMuted, fontStyle: 'italic' }}>No written review</Text>
                )}
              </View>
            ))}
          </ScrollView>
        </Animated.View>
      )}

      <Modal visible={!!deleteTarget} transparent animationType="fade" onRequestClose={() => setDeleteTarget(null)}>
        <View style={{
          flex: 1, backgroundColor: 'rgba(0,0,0,0.85)',
          justifyContent: 'center', alignItems: 'center', padding: 20,
        }}>
          <View style={{
            backgroundColor: A.card, borderRadius: 20, borderWidth: 1,
            borderColor: A.border, padding: 24, width: '100%', maxWidth: 400,
            overflow: 'hidden',
          }}>
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, backgroundColor: A.red, opacity: 0.6 }} />
            <View style={{ alignItems: 'center', marginBottom: 20 }}>
              <View style={{
                width: 60, height: 60, borderRadius: 30,
                backgroundColor: A.redDim, borderWidth: 1, borderColor: A.red + '44',
                justifyContent: 'center', alignItems: 'center', marginBottom: 14,
              }}>
                <AlertTriangle size={28} color={A.red} />
              </View>
              <Text style={{ fontSize: 20, fontWeight: '800', color: A.text, marginBottom: 8 }}>Delete Review?</Text>
              <Text style={{ fontSize: 13, color: A.textSub, textAlign: 'center', lineHeight: 20 }}>
                This will permanently remove the review from{' '}
                <Text style={{ color: A.text, fontWeight: '700' }}>{deleteTarget?.customers?.full_name}</Text>
                {' '}for driver{' '}
                <Text style={{ color: A.text, fontWeight: '700' }}>{deleteTarget?.drivers?.full_name}</Text>.
              </Text>
            </View>

            {deleteTarget && (
              <View style={{
                backgroundColor: A.surface, borderRadius: 10, borderWidth: 1,
                borderColor: A.border, padding: 12, marginBottom: 20, gap: 6,
              }}>
                <StarRow rating={deleteTarget.rating} />
                {deleteTarget.review_text && (
                  <Text style={{ fontSize: 12, color: A.textSub, lineHeight: 18 }} numberOfLines={3}>
                    "{deleteTarget.review_text}"
                  </Text>
                )}
              </View>
            )}

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                style={{
                  flex: 1, paddingVertical: 12, borderRadius: 10,
                  backgroundColor: A.surface, borderWidth: 1, borderColor: A.border, alignItems: 'center',
                }}
                onPress={() => setDeleteTarget(null)}
              >
                <Text style={{ color: A.textSub, fontSize: 14, fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  flex: 1, paddingVertical: 12, borderRadius: 10,
                  backgroundColor: A.redDim, borderWidth: 1, borderColor: A.red + '55',
                  alignItems: 'center', opacity: deleting ? 0.5 : 1,
                }}
                onPress={deleteReview}
                disabled={deleting}
              >
                {deleting
                  ? <ActivityIndicator size="small" color={A.red} />
                  : <Text style={{ color: A.red, fontSize: 14, fontWeight: '800' }}>Delete</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
