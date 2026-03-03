import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
  Alert,
  Modal,
  Dimensions,
  Pressable,
  Animated,
  ScrollView,
  Clipboard,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import GradientView from '../components/GradientView';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';
import { pickImages } from '../utils/pickImage';
import { useTheme } from '../theme';
import getFirebaseError from '../utils/getFirebaseError';
import CameraIcon from '../assets/camera.svg';
import SendIcon from '../assets/send.svg';
import RoketLogo from '../assets/roket-logo-2.svg';

interface Message {
  id: string;
  senderId: string;
  text?: string;
  imageURL?: string;
  imageExpired?: boolean;
  moderated?: boolean;
  timestamp: any;
  likedBy?: string[];
  deleted?: boolean;
  flagged?: boolean;
  flaggedReason?: string;
  revealedBy?: string;
}

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

function FullscreenZoomImage({ uri, onClose }: { uri: string; onClose: () => void }) {
  const scale = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  const scaleVal = useRef(1);
  const txVal = useRef(0);
  const tyVal = useRef(0);
  const pinchDist0 = useRef(0);
  const pinchScale0 = useRef(1);
  const panStartX = useRef(0);
  const panStartY = useRef(0);
  const lastTxVal = useRef(0);
  const lastTyVal = useRef(0);
  const wasPinching = useRef(false);
  const touchStart = useRef({ time: 0, x: 0, y: 0 });

  useEffect(() => {
    const s1 = scale.addListener(({ value }) => { scaleVal.current = value; });
    const s2 = translateX.addListener(({ value }) => { txVal.current = value; });
    const s3 = translateY.addListener(({ value }) => { tyVal.current = value; });
    return () => { scale.removeListener(s1); translateX.removeListener(s2); translateY.removeListener(s3); };
  }, []);

  const imgH = SCREEN_H * 0.8;

  const dist = (touches: any[]) => {
    const dx = touches[0].pageX - touches[1].pageX;
    const dy = touches[0].pageY - touches[1].pageY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const clampTx = (tx: number, s: number) => {
    const maxX = (SCREEN_W * (s - 1)) / 2;
    return Math.max(-maxX, Math.min(maxX, tx));
  };

  const clampTy = (ty: number, s: number) => {
    const maxY = (imgH * (s - 1)) / 2;
    return Math.max(-maxY, Math.min(maxY, ty));
  };

  const onTouchStart = (e: any) => {
    const t = e.nativeEvent.touches;
    if (t.length === 2) {
      wasPinching.current = true;
      pinchDist0.current = dist(t);
      pinchScale0.current = scaleVal.current;
    } else if (t.length === 1) {
      touchStart.current = { time: Date.now(), x: t[0].pageX, y: t[0].pageY };
      panStartX.current = t[0].pageX;
      panStartY.current = t[0].pageY;
      lastTxVal.current = txVal.current;
      lastTyVal.current = tyVal.current;
    }
  };

  const onTouchMove = (e: any) => {
    const t = e.nativeEvent.touches;
    if (t.length >= 2 && pinchDist0.current > 0) {
      const d = dist(t);
      const s = Math.max(1, Math.min(pinchScale0.current * (d / pinchDist0.current), 5));
      scale.setValue(s);
      // Clamp eksisterende translation til nye grænser
      translateX.setValue(clampTx(txVal.current, s));
      translateY.setValue(clampTy(tyVal.current, s));
    } else if (t.length === 1 && scaleVal.current > 1 && !wasPinching.current) {
      const damp = 0.6;
      const rawX = lastTxVal.current + (t[0].pageX - panStartX.current) * damp;
      const rawY = lastTyVal.current + (t[0].pageY - panStartY.current) * damp;
      translateX.setValue(clampTx(rawX, scaleVal.current));
      translateY.setValue(clampTy(rawY, scaleVal.current));
    }
  };

  const onTouchEnd = (e: any) => {
    const remaining = e.nativeEvent.touches;
    if (remaining.length === 0) {
      const ch = e.nativeEvent.changedTouches[0];
      const elapsed = Date.now() - touchStart.current.time;
      const movedX = Math.abs(ch.pageX - touchStart.current.x);
      const movedY = Math.abs(ch.pageY - touchStart.current.y);

      // Enkelt tryk → luk (hvis ikke zoomet og ingen bevægelse)
      if (!wasPinching.current && scaleVal.current <= 1 && elapsed < 300 && movedX < 10 && movedY < 10) {
        onClose();
        return;
      }

      wasPinching.current = false;
      pinchDist0.current = 0;

      if (scaleVal.current <= 1.1) {
        Animated.parallel([
          Animated.spring(scale, { toValue: 1, useNativeDriver: true }),
          Animated.spring(translateX, { toValue: 0, useNativeDriver: true }),
          Animated.spring(translateY, { toValue: 0, useNativeDriver: true }),
        ]).start();
      }
    } else if (remaining.length === 1) {
      // Én finger løftet efter pinch — nulstil pan-tracking
      pinchDist0.current = 0;
      panStartX.current = remaining[0].pageX;
      panStartY.current = remaining[0].pageY;
      lastTxVal.current = txVal.current;
      lastTyVal.current = tyVal.current;
    }
  };

  return (
    <View
      style={styles.fullscreenOverlay}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <Animated.Image
        source={{ uri }}
        style={[styles.fullscreenImage, {
          transform: [{ scale }, { translateX }, { translateY }],
        }]}
        resizeMode="contain"
      />
      <TouchableOpacity style={styles.fullscreenCloseBtn} onPress={onClose}>
        <Text style={styles.fullscreenClose}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}

function BubbleGradient({ primaryBlue, primaryRed }: { primaryBlue: string; primaryRed: string }) {
  const [width, setWidth] = useState(0);
  const listPadding = 16;
  const w = width || SCREEN_W * 0.5;
  const left = SCREEN_W - listPadding - w;

  return (
    <LinearGradient
      colors={[primaryBlue, primaryRed]}
      start={{ x: -left / w, y: 0 }}
      end={{ x: (SCREEN_W - left) / w, y: 0 }}
      style={StyleSheet.absoluteFillObject}
      onLayout={(e) => {
        if (!width) setWidth(e.nativeEvent.layout.width);
      }}
    />
  );
}

function getOrCreateChatId(uid1: string, uid2: string): string {
  // Deterministisk chat ID: altid samme uanset rækkefølge
  return [uid1, uid2].sort().join('_');
}

export default function ChatScreen({ route, navigation }: any) {
  const { colors, timeFormat, t, language, showTestBadges } = useTheme();
  const insets = useSafeAreaInsets();
  const { otherUser, fromProfile } = route.params as {
    otherUser: { id: string; displayName: string; testAccount?: boolean };
    fromProfile?: boolean;
  };

  const currentUser = auth().currentUser;
  const chatId = currentUser ? getOrCreateChatId(currentUser.uid, otherUser.id) : '';

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sendingImage, setSendingImage] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const [pendingImages, setPendingImages] = useState<string[]>([]);
  const [reportMessage, setReportMessage] = useState<Message | null>(null);
  const [reportText, setReportText] = useState('');
  const flatListRef = useRef<FlatList>(null);
  const lastTapRef = useRef<{ id: string; time: number }>({ id: '', time: 0 });

  // Tjek om en af parterne har blokeret den anden
  useEffect(() => {
    if (!currentUser) return;
    const checkBlock = async () => {
      const [myDoc, theirDoc] = await Promise.all([
        firestore().collection('users').doc(currentUser.uid).get(),
        firestore().collection('users').doc(otherUser.id).get(),
      ]);
      const myBlocked: string[] = myDoc.data()?.blockedUsers ?? [];
      const theirBlocked: string[] = theirDoc.data()?.blockedUsers ?? [];
      setBlocked(myBlocked.includes(otherUser.id) || theirBlocked.includes(currentUser.uid));
    };
    checkBlock();
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    let unsubscribe: (() => void) | undefined;

    const setup = async () => {
      // Opret chat-dokument først, så Firestore-regler tillader læsning af messages
      const chatRef = firestore().collection('chats').doc(chatId);
      await chatRef.set(
        {
          participants: [currentUser.uid, otherUser.id],
          createdAt: firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      // Lyt til beskeder real-time
      unsubscribe = firestore()
        .collection('chats')
        .doc(chatId)
        .collection('messages')
        .onSnapshot(snapshot => {
          if (!snapshot) {
            setLoading(false);
            return;
          }
          const msgs: Message[] = snapshot.docs.map(doc => ({
            id: doc.id,
            senderId: doc.data().senderId,
            text: doc.data().text,
            imageURL: doc.data().imageURL,
            timestamp: doc.data().timestamp,
            imageExpired: doc.data().imageExpired ?? false,
            moderated: doc.data().moderated ?? true,
            likedBy: doc.data().likedBy ?? [],
            deleted: doc.data().deleted ?? false,
            flagged: doc.data().flagged ?? false,
            flaggedReason: doc.data().flaggedReason,
            revealedBy: doc.data().revealedBy,
          }));
          msgs.sort((a, b) => {
            if (!a.timestamp) return -1;
            if (!b.timestamp) return 1;
            const aTime = a.timestamp.toDate ? a.timestamp.toDate().getTime() : 0;
            const bTime = b.timestamp.toDate ? b.timestamp.toDate().getTime() : 0;
            return bTime - aTime;
          });
          setMessages(msgs);
          setLoading(false);

          // Markér chatten som læst (brug Timestamp.now() så lokal cache opdateres straks)
          chatRef.update({
            [`lastRead.${currentUser.uid}`]: firestore.Timestamp.now(),
          }).catch(() => {});
        });
    };

    setup();

    return () => unsubscribe?.();
  }, [chatId]);

  if (!currentUser) return null;

  const sendMessage = async () => {
    const text = inputText.trim();
    if (!text) return;

    setInputText('');

    const chatRef = firestore().collection('chats').doc(chatId);
    const messageRef = chatRef.collection('messages').doc();

    await messageRef.set({
      senderId: currentUser.uid,
      text,
      timestamp: firestore.FieldValue.serverTimestamp(),
    });

    await chatRef.set(
      {
        lastMessage: text.slice(0, 500),
        lastMessageTime: firestore.FieldValue.serverTimestamp(),
        lastMessageSenderId: currentUser.uid,
      },
      { merge: true }
    );
  };

  const handlePickImage = async () => {
    const uris = await pickImages(3);
    if (uris.length > 0) setPendingImages(uris);
  };

  const handleAddMoreImages = async () => {
    const remaining = 3 - pendingImages.length;
    if (remaining <= 0) return;
    const uris = await pickImages(remaining);
    if (uris.length > 0) {
      setPendingImages(prev => [...prev, ...uris].slice(0, 3));
    }
  };

  const handleConfirmSendImages = async () => {
    if (pendingImages.length === 0) return;
    const uris = [...pendingImages];
    setPendingImages([]);
    setSendingImage(true);
    try {
      const chatRef = firestore().collection('chats').doc(chatId);

      for (const uri of uris) {
        const messageRef = chatRef.collection('messages').doc();
        const ref = storage().ref(`chatImages/${chatId}/${messageRef.id}.jpg`);
        await ref.putFile(uri);
        const imageURL = await ref.getDownloadURL();

        await messageRef.set({
          senderId: currentUser.uid,
          imageURL,
          moderated: false,
          timestamp: firestore.FieldValue.serverTimestamp(),
        });
      }

      await chatRef.set(
        {
          lastMessage: t.chatPhotoLabel,
          lastMessageTime: firestore.FieldValue.serverTimestamp(),
          lastMessageSenderId: currentUser.uid,
        },
        { merge: true }
      );
    } catch (error: any) {
      Alert.alert(t.error, getFirebaseError(error, t));
    } finally {
      setSendingImage(false);
    }
  };

  const formatTime = (timestamp: any): string => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      hour12: timeFormat === '12h',
    });
  };

  const isImageExpired = (timestamp: any): boolean => {
    if (!timestamp) return false;
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return Date.now() - date.getTime() > 12 * 60 * 60 * 1000;
  };

  const getTimeRemaining = (timestamp: any): string => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const msLeft = 12 * 60 * 60 * 1000 - (Date.now() - date.getTime());
    if (msLeft <= 0) return '';
    const hoursLeft = Math.floor(msLeft / (60 * 60 * 1000));
    const minsLeft = Math.floor((msLeft % (60 * 60 * 1000)) / (60 * 1000));
    if (hoursLeft > 0) return t.chatExpiresHoursMinutes(hoursLeft, minsLeft);
    return t.chatExpiresMinutes(minsLeft);
  };

  const handleDoubleTap = (messageId: string) => {
    const now = Date.now();
    const last = lastTapRef.current;
    if (last.id === messageId && now - last.time < 300) {
      // Dobbelt-tryk: toggle like
      const msgRef = firestore()
        .collection('chats')
        .doc(chatId)
        .collection('messages')
        .doc(messageId);
      const msg = messages.find(m => m.id === messageId);
      const alreadyLiked = msg?.likedBy?.includes(currentUser.uid);
      msgRef.update({
        likedBy: alreadyLiked
          ? firestore.FieldValue.arrayRemove(currentUser.uid)
          : firestore.FieldValue.arrayUnion(currentUser.uid),
      }).catch(err => console.warn('Like fejl:', err.message));
      lastTapRef.current = { id: '', time: 0 };
    } else {
      lastTapRef.current = { id: messageId, time: now };
    }
  };

  const handleMessageAction = (message: Message) => {
    const isMe = message.senderId === currentUser.uid;
    const buttons: any[] = [];

    // Kopier (kun hvis der er tekst)
    if (message.text && !message.deleted) {
      buttons.push({
        text: t.chatCopy,
        onPress: () => {
          Clipboard.setString(message.text!);
        },
      });
    }

    // Slet (kun egne beskeder)
    if (isMe && !message.deleted) {
      buttons.push({
        text: t.delete,
        style: 'destructive',
        onPress: () => {
          Alert.alert(t.chatDeleteTitle, t.chatDeleteConfirm, [
            { text: t.cancel, style: 'cancel' },
            {
              text: t.delete,
              style: 'destructive',
              onPress: () => {
                storage().ref(`chatImages/${chatId}/${message.id}.jpg`).delete().catch(() => {});
                firestore()
                  .collection('chats')
                  .doc(chatId)
                  .collection('messages')
                  .doc(message.id)
                  .update({ deleted: true, text: null, imageURL: null })
                  .catch(err => Alert.alert(t.error, getFirebaseError(err, t)));
              },
            },
          ]);
        },
      });
    }

    // Rapporter (kun andres beskeder)
    if (!isMe) {
      buttons.push({
        text: t.chatReportMessage,
        style: 'destructive',
        onPress: () => setReportMessage(message),
      });
    }

    if (buttons.length === 0) return;

    Alert.alert(t.chatMessageActions, undefined, [
      { text: t.cancel, style: 'cancel' },
      ...buttons,
    ]);
  };

  const handleSendReport = () => {
    if (!reportMessage) return;
    const msg = reportMessage;
    setReportMessage(null);
    const reportData: any = {
      reporterId: currentUser.uid,
      reportedUserId: msg.senderId,
      chatId,
      messageId: msg.id,
      messageText: msg.text || null,
      messageImageURL: msg.imageURL || null,
      createdAt: firestore.FieldValue.serverTimestamp(),
    };
    if (reportText.trim()) {
      reportData.reason = reportText.trim();
    }
    firestore()
      .collection('reports')
      .add(reportData)
      .then(() => {
        setReportText('');
        Alert.alert(t.chatReportSent, t.chatReportReceived);
      })
      .catch(err => Alert.alert(t.error, getFirebaseError(err, t)));
  };

  const handleRevealFlagged = (messageId: string) => {
    Alert.alert(
      t.chatFlaggedTitle,
      t.chatFlaggedWarning,
      [
        { text: t.cancel, style: 'cancel' },
        {
          text: t.chatFlaggedReveal,
          onPress: () => {
            firestore()
              .collection('chats')
              .doc(chatId)
              .collection('messages')
              .doc(messageId)
              .update({ revealedBy: currentUser.uid })
              .catch(err => console.warn('Reveal fejl:', err.message));
          },
        },
      ],
    );
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isMe = item.senderId === currentUser.uid;
    const expired = item.imageExpired || (item.imageURL && isImageExpired(item.timestamp)) || (!item.text && !item.imageURL && !item.deleted);
    const isLiked = item.likedBy && item.likedBy.length > 0;
    const isFlaggedImage = item.flagged && item.imageURL && !expired && !item.deleted;
    const isRevealed = !!item.revealedBy;
    return (
      <View style={[styles.messageRow, isMe ? styles.messageRowMe : styles.messageRowThem]}>
        <Pressable
          style={styles.messagePressable}
          onPress={() => handleDoubleTap(item.id)}
          onLongPress={!item.deleted ? () => handleMessageAction(item) : undefined}
        >
          <View style={[
            styles.bubble,
            isMe
              ? [styles.bubbleMe, styles.bubbleGradient]
              : [styles.bubbleThem, { backgroundColor: colors.bubbleReceived }],
            item.imageURL && !expired && !item.deleted && styles.bubbleImage,
          ]}>
            {isMe && <BubbleGradient primaryBlue={colors.primaryBlue} primaryRed={colors.primaryRed} />}
            {item.deleted ? (
              <Text style={[styles.deletedText, { color: isMe ? 'rgba(255,255,255,0.5)' : colors.textMuted }]}>
                {t.chatDeleted}
              </Text>
            ) : (item.imageURL || expired) ? (
              expired ? (
                <Text style={[
                  styles.expiredText,
                  isMe ? { color: 'rgba(255,255,255,0.6)' } : { color: colors.textMuted },
                ]}>
                  {t.chatImageExpired}
                </Text>
              ) : !item.moderated ? (
                <View style={[styles.chatImage, styles.pendingImageContainer]}>
                  <ActivityIndicator size="small" color={isMe ? '#fff' : colors.textMuted} />
                  <Text style={[styles.pendingImageText, { color: isMe ? '#fff' : colors.textMuted }]}>{t.chatImagePending}</Text>
                </View>
              ) : (
                <>
                  {isFlaggedImage && !isRevealed ? (
                    isMe ? (
                      <View style={styles.chatImage}>
                        <Image source={{ uri: item.imageURL }} style={[styles.chatImage, { position: 'absolute' }]} resizeMode="cover" blurRadius={30} />
                        <View style={styles.flaggedOverlay}>
                          <Text style={styles.flaggedIcon}>!</Text>
                          <Text style={styles.flaggedText}>{t.chatFlaggedLabel}</Text>
                        </View>
                      </View>
                    ) : (
                      <TouchableOpacity activeOpacity={0.85} onPress={() => handleRevealFlagged(item.id)}>
                        <View style={styles.chatImage}>
                          <Image source={{ uri: item.imageURL }} style={[styles.chatImage, { position: 'absolute' }]} resizeMode="cover" blurRadius={30} />
                          <View style={styles.flaggedOverlay}>
                            <Text style={styles.flaggedIcon}>!</Text>
                            <Text style={styles.flaggedText}>{t.chatFlaggedLabel}</Text>
                          </View>
                        </View>
                      </TouchableOpacity>
                    )
                  ) : (
                    <TouchableOpacity activeOpacity={0.85} onPress={() => setFullscreenImage(item.imageURL!)}>
                      <Image source={{ uri: item.imageURL }} style={styles.chatImage} resizeMode="cover" />
                    </TouchableOpacity>
                  )}
                  <Text style={[styles.expiryText, isMe ? { color: 'rgba(255,255,255,0.5)' } : { color: colors.textMuted }]}>
                    {getTimeRemaining(item.timestamp)}
                  </Text>
                </>
              )
            ) : (
              <Text style={[
                styles.messageText,
                isMe
                  ? { color: colors.textWhite }
                  : { color: colors.bubbleReceivedText },
              ]}>
                {item.text}
              </Text>
            )}
            {!item.deleted && (
              <Text style={[styles.timestamp, isMe ? styles.timestampMe : styles.timestampThem]}>
                {formatTime(item.timestamp)}
              </Text>
            )}
          </View>
          {isLiked && (
            <View style={[styles.heartBadge, { backgroundColor: colors.white }, isMe ? styles.heartBadgeMe : styles.heartBadgeThem]}>
              <Text style={styles.heartEmoji}>❤️</Text>
            </View>
          )}
        </Pressable>
      </View>
    );
  };

  return (
    <SafeAreaView edges={['bottom']} style={[styles.container, { backgroundColor: colors.background }]}>
      <GradientView
        colors={[colors.primaryBlue, colors.primaryRed]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.header, { paddingTop: insets.top + 10 }]}
      >
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={[styles.backButtonText, { color: colors.textWhite }]}>←</Text>
        </TouchableOpacity>
        {fromProfile ? (
          <View style={styles.headerInfo}>
            <View style={styles.headerNameRow}>
              <Text style={[styles.headerName, { color: colors.textWhite }]}>{otherUser.displayName}</Text>
              {showTestBadges && otherUser.testAccount && <View style={styles.headerTestBadge}><Text style={styles.headerTestBadgeText}>{t.testAccount}</Text></View>}
            </View>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.headerInfo}
            onPress={async () => {
              const [otherDoc, myLocDoc, theirLocDoc] = await Promise.all([
                firestore().collection('users').doc(otherUser.id).get(),
                firestore().collection('userLocations').doc(currentUser.uid).get(),
                firestore().collection('userLocations').doc(otherUser.id).get(),
              ]);
              const data = otherDoc.data();
              if (!data) return;

              let distance: number | undefined;
              const myLoc = myLocDoc.data()?.location;
              const theirLoc = theirLocDoc.data()?.location;
              if (myLoc && theirLoc) {
                const R = 6371;
                const toRad = (d: number) => d * (Math.PI / 180);
                const dLat = toRad(theirLoc.latitude - myLoc.latitude);
                const dLon = toRad(theirLoc.longitude - myLoc.longitude);
                const a = Math.sin(dLat / 2) ** 2 +
                  Math.cos(toRad(myLoc.latitude)) * Math.cos(toRad(theirLoc.latitude)) *
                  Math.sin(dLon / 2) ** 2;
                distance = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
              }

              navigation.navigate('ProfileView', {
                user: {
                  id: otherUser.id,
                  displayName: data.displayName,
                  bio: data.bio || '',
                  photoURL: data.photoURL || null,
                  lastSeen: data.lastSeen?.toDate?.()?.getTime(),
                  distanceMode: data.distanceMode ?? 'exact',
                  age: data.age,
                  gender: data.gender,
                  sexuality: data.sexuality,
                  photos: data.photos,
                  testAccount: data.testAccount ?? false,
                  distance,
                  location: theirLoc ? { latitude: theirLoc.latitude, longitude: theirLoc.longitude } : undefined,
                },
                fromChat: true,
              });
            }}
          >
            <View style={styles.headerNameRow}>
              <Text style={[styles.headerName, { color: colors.textWhite }]}>{otherUser.displayName}</Text>
              {showTestBadges && otherUser.testAccount && <View style={styles.headerTestBadge}><Text style={styles.headerTestBadgeText}>{t.testAccount}</Text></View>}
            </View>
          </TouchableOpacity>
        )}
      </GradientView>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior="padding"
        keyboardVerticalOffset={0}
      >
        <View style={styles.watermark} pointerEvents="none">
          <RoketLogo width={200} height={200} fill={colors.textMuted} />
        </View>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primaryBlueText} />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.messageList}
            inverted
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={[styles.emptyGreeting, { color: colors.textMuted }]}>{t.chatSayHi(otherUser.displayName)}</Text>
                <View style={styles.tipsContainer}>
                  <Text style={[styles.tipText, { color: colors.textMuted }]}>- {t.chatTipDoubleTap}</Text>
                  <Text style={[styles.tipText, { color: colors.textMuted }]}>- {t.chatTipPhotos}</Text>
                  <Text style={[styles.tipText, { color: colors.textMuted }]}>- {t.chatTipImageExpiry}</Text>
                  <Text style={[styles.tipText, { color: colors.textMuted }]}>- {t.chatTipLongPress}</Text>
                  <Text style={[styles.tipText, { color: colors.textMuted }]}>- {t.chatTipDeleted}</Text>
                </View>
              </View>
            }
          />
        )}

        {blocked ? (
          <View style={[styles.blockedBar, { backgroundColor: colors.white, borderTopColor: colors.border }]}>
            <Text style={[styles.blockedText, { color: colors.textMuted }]}>
              {t.chatBlocked}
            </Text>
          </View>
        ) : (
        <View>
          {inputText.length > 800 && (
            <Text style={[styles.charCounter, { color: inputText.length > 950 ? colors.primaryRed : colors.textMuted }]}>
              {inputText.length}/1000
            </Text>
          )}
        <View style={[styles.inputRow, { backgroundColor: colors.white, borderTopColor: colors.border }]}>
          <TouchableOpacity
            style={styles.imageButton}
            onPress={handlePickImage}
            disabled={sendingImage}
          >
            {sendingImage ? (
              <ActivityIndicator size="small" color={colors.primaryRed} />
            ) : (
              <CameraIcon width={22} height={22} fill={colors.primaryRed} />
            )}
          </TouchableOpacity>
          <TextInput
            style={[styles.input, { backgroundColor: colors.background, color: colors.textPrimary }]}
            value={inputText}
            onChangeText={setInputText}
            placeholder={t.chatInputPlaceholder}
            placeholderTextColor={colors.textMuted}
            multiline
            maxLength={1000}
            onSubmitEditing={sendMessage}
          />
          <TouchableOpacity
            style={[styles.sendButton, { backgroundColor: colors.primaryRed }, !inputText.trim() && styles.sendButtonDisabled]}
            onPress={sendMessage}
            disabled={!inputText.trim()}
          >
            <SendIcon width={20} height={20} stroke={colors.textWhite} />
          </TouchableOpacity>
        </View>
        </View>
        )}
      </KeyboardAvoidingView>

      <Modal visible={!!fullscreenImage} transparent animationType="fade" onRequestClose={() => setFullscreenImage(null)}>
        <FullscreenZoomImage uri={fullscreenImage!} onClose={() => setFullscreenImage(null)} />
      </Modal>

      <Modal visible={!!reportMessage} transparent animationType="fade" onRequestClose={() => setReportMessage(null)}>
        <View style={styles.reportOverlay}>
          <View style={[styles.reportCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.reportTitle, { color: colors.textPrimary }]}>{t.chatReportConfirm}</Text>
            <Text style={[styles.reportDesc, { color: colors.textSecondary }]}>{t.chatReportDescription}</Text>
            <TextInput
              style={[styles.reportInput, {
                borderColor: colors.inputBorder,
                backgroundColor: colors.inputBackground,
                color: colors.textPrimary,
              }]}
              placeholder={t.profileReportPlaceholder}
              placeholderTextColor={colors.textMuted}
              value={reportText}
              onChangeText={setReportText}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            <View style={styles.reportButtons}>
              <TouchableOpacity
                style={[styles.reportButton, { backgroundColor: colors.backgroundLight }]}
                onPress={() => { setReportMessage(null); setReportText(''); }}
              >
                <Text style={[styles.reportButtonText, { color: colors.textPrimary }]}>{t.cancel}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.reportButton, { backgroundColor: colors.primaryRed }]}
                onPress={handleSendReport}
              >
                <Text style={[styles.reportButtonText, { color: '#FFF' }]}>{t.profileReportSend}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={pendingImages.length > 0} transparent animationType="fade">
        <View style={styles.previewOverlay}>
          {pendingImages.length === 1 ? (
            <View>
              <Image
                source={{ uri: pendingImages[0] }}
                style={styles.previewImage}
                resizeMode="contain"
              />
            </View>
          ) : (
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              style={styles.previewScroll}
              contentContainerStyle={styles.previewScrollContent}
            >
              {pendingImages.map((uri, i) => (
                <View key={i} style={styles.previewSlide}>
                  <Image source={{ uri }} style={styles.previewImage} resizeMode="contain" />
                  <TouchableOpacity
                    style={styles.previewRemoveBtn}
                    onPress={() => setPendingImages(prev => prev.filter((_, idx) => idx !== i))}
                  >
                    <Text style={styles.previewRemoveText}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          )}
          <Text style={styles.previewCount}>{pendingImages.length}/3</Text>
          <View style={styles.previewButtons}>
            <TouchableOpacity
              style={[styles.previewButton, styles.previewButtonCancel]}
              onPress={() => setPendingImages([])}
            >
              <Text style={styles.previewButtonText}>{t.cancel}</Text>
            </TouchableOpacity>
            {pendingImages.length < 3 && (
              <TouchableOpacity
                style={[styles.previewButton, { backgroundColor: 'rgba(255,255,255,0.25)' }]}
                onPress={handleAddMoreImages}
              >
                <Text style={styles.previewButtonText}>+ {language === 'da' ? 'Tilføj' : 'Add'}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.previewButton, { backgroundColor: colors.primaryRed }]}
              onPress={handleConfirmSendImages}
            >
              <Text style={styles.previewButtonText}>{t.send}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  watermark: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0.08,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 14,
    paddingHorizontal: 16,
  },
  backButton: {
    marginRight: 12,
  },
  backButtonText: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  headerInfo: {
    flex: 1,
  },
  headerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerName: {
    fontSize: 18,
    fontWeight: '700',
  },
  headerTestBadge: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  headerTestBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messageList: {
    padding: 16,
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyGreeting: {
    fontSize: 16,
    marginBottom: 32,
  },
  tipsContainer: {
    gap: 10,
  },
  tipText: {
    fontSize: 14,
    textAlign: 'center',
  },
  messageRow: {
    marginBottom: 12,
    flexDirection: 'row',
  },
  messageRowMe: {
    justifyContent: 'flex-end',
  },
  messageRowThem: {
    justifyContent: 'flex-start',
  },
  messagePressable: {
    maxWidth: '75%',
  },
  bubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
  },
  bubbleMe: {
    borderBottomRightRadius: 4,
  },
  bubbleGradient: {
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  bubbleThem: {
    borderBottomLeftRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  timestamp: {
    fontSize: 11,
    marginTop: 4,
  },
  timestampMe: {
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'right',
  },
  timestampThem: {
    color: '#aaa',
  },
  blockedBar: {
    padding: 16,
    borderTopWidth: 1,
    alignItems: 'center',
  },
  blockedText: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  charCounter: {
    fontSize: 11,
    textAlign: 'right',
    paddingRight: 16,
    paddingTop: 4,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    maxHeight: 120,
  },
  sendButton: {
    marginLeft: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
  },
  sendButtonText: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  imageButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  imageButtonText: {
    fontSize: 24,
  },
  bubbleImage: {
    padding: 4,
  },
  chatImage: {
    width: 200,
    height: 200,
    borderRadius: 14,
    overflow: 'hidden',
  },
  pendingImageContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.05)',
    gap: 8,
  },
  pendingImageText: {
    fontSize: 13,
    fontWeight: '500',
  },
  flaggedOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 14,
  },
  flaggedIcon: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '800',
    width: 40,
    height: 40,
    lineHeight: 40,
    textAlign: 'center',
    backgroundColor: 'rgba(255,59,48,0.8)',
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 8,
  },
  flaggedText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  deletedText: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  expiredText: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  expiryText: {
    fontSize: 11,
    marginTop: 4,
  },
  heartBadge: {
    position: 'absolute',
    bottom: -8,
    borderRadius: 10,
    paddingHorizontal: 4,
    paddingVertical: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 3,
  },
  heartBadgeMe: {
    left: 4,
  },
  heartBadgeThem: {
    right: 4,
  },
  heartEmoji: {
    fontSize: 14,
  },
  fullscreenOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenImage: {
    width: SCREEN_W,
    height: SCREEN_H * 0.8,
  },
  fullscreenCloseBtn: {
    position: 'absolute',
    top: 50,
    right: 20,
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenClose: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
  },
  previewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewScroll: {
    maxHeight: SCREEN_H * 0.7,
    flexGrow: 0,
  },
  previewScrollContent: {
    alignItems: 'center',
  },
  previewSlide: {
    width: SCREEN_W,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewImage: {
    width: SCREEN_W * 0.9,
    height: SCREEN_H * 0.6,
  },
  previewRemoveBtn: {
    position: 'absolute',
    top: 10,
    right: SCREEN_W * 0.08,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewRemoveText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  previewCount: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    marginTop: 8,
  },
  previewButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  previewButton: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 24,
  },
  previewButtonCancel: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  previewButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  reportOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  reportCard: {
    width: '100%',
    borderRadius: 16,
    padding: 24,
  },
  reportTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 6,
  },
  reportDesc: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  reportInput: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    minHeight: 100,
    marginBottom: 20,
  },
  reportButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  reportButton: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  reportButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
