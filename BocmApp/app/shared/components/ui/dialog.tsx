import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { theme } from '../../lib/theme';

interface DialogProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  showCloseButton?: boolean;
}

interface DialogContentProps {
  children: React.ReactNode;
}

interface DialogHeaderProps {
  children: React.ReactNode;
}

interface DialogFooterProps {
  children: React.ReactNode;
}

interface DialogTitleProps {
  children: React.ReactNode;
}

const Dialog: React.FC<DialogProps> = ({ 
  visible, 
  onClose, 
  title, 
  children, 
  showCloseButton = true 
}) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity 
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View 
          style={styles.dialog}
          onStartShouldSetResponder={() => true}
        >
          {title && (
            <View style={styles.header}>
              <Text style={styles.title}>{title}</Text>
              {showCloseButton && (
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                  <Text style={styles.closeButtonText}>×</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
          {children}
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const DialogContent: React.FC<DialogContentProps> = ({ children }) => {
  return <View style={styles.content}>{children}</View>;
};

const DialogHeader: React.FC<DialogHeaderProps> = ({ children }) => {
  return <View style={styles.header}>{children}</View>;
};

const DialogFooter: React.FC<DialogFooterProps> = ({ children }) => {
  return <View style={styles.footer}>{children}</View>;
};

const DialogTitle: React.FC<DialogTitleProps> = ({ children }) => {
  return <Text style={styles.title}>{children}</Text>;
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dialog: {
    backgroundColor: theme.colors.background,
    borderRadius: 12,
    padding: 20,
    margin: 20,
    minWidth: 300,
    maxWidth: Dimensions.get('window').width - 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.foreground,
  },
  closeButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 18,
    color: theme.colors.foreground,
    lineHeight: 20,
  },
  content: {
    marginBottom: 16,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
});

export { Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle }; 