import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface Props {
  text: string;
  textColor: string;
  headingColor: string;
  mutedColor: string;
}

export default function FormattedLegalText({ text, textColor, headingColor, mutedColor }: Props) {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let listItems: string[] = [];
  let key = 0;

  const flushList = () => {
    if (listItems.length === 0) return;
    elements.push(
      <View key={key++} style={styles.list}>
        {listItems.map((item, i) => (
          <View key={i} style={styles.listItem}>
            <Text style={[styles.bullet, { color: mutedColor }]}>{'\u2022'}</Text>
            <Text style={[styles.listText, { color: textColor }]}>{item}</Text>
          </View>
        ))}
      </View>
    );
    listItems = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isListItem = /^[\-\u2022]\s/.test(line);

    if (!isListItem) flushList();

    if (/^#\s+/.test(line)) {
      elements.push(
        <Text key={key++} style={[styles.heading, { color: headingColor }]}>
          {line.replace(/^#\s+/, '')}
        </Text>
      );
    } else if (isListItem) {
      listItems.push(line.replace(/^[\-\u2022]\s+/, ''));
    } else if (line.trim() === '') {
      continue;
    } else {
      elements.push(
        <Text key={key++} style={[styles.paragraph, { color: textColor }]}>
          {line}
        </Text>
      );
    }
  }
  flushList();

  return <View>{elements}</View>;
}

const styles = StyleSheet.create({
  heading: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 18,
    marginBottom: 6,
  },
  paragraph: {
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 10,
  },
  list: {
    marginBottom: 10,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  bullet: {
    fontSize: 14,
    lineHeight: 22,
    marginRight: 8,
    width: 12,
  },
  listText: {
    fontSize: 14,
    lineHeight: 22,
    flex: 1,
  },
});
