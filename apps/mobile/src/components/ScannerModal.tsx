import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';

interface ScannerModalProps {
  visible: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
}

export function ScannerModal({ visible, onClose, onScan }: ScannerModalProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  useEffect(() => {
    if (visible) {
      setScanned(false);
      if (!permission?.granted) {
        void requestPermission();
      }
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        {!permission?.granted ? (
          <View style={styles.center}>
            <Text style={styles.text}>Se requieren permisos de cámara para escanear.</Text>
            <Pressable style={styles.btn} onPress={requestPermission}>
              <Text style={styles.btnText}>Conceder Permisos</Text>
            </Pressable>
            <Pressable style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeText}>Cerrar</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.cameraContainer}>
            <CameraView
              style={StyleSheet.absoluteFill}
              onBarcodeScanned={({ data }) => {
                if (!scanned && data) {
                  setScanned(true);
                  onScan(data);
                  onClose();
                }
              }}
              barcodeScannerSettings={{
                barcodeTypes: ['qr', 'code128', 'ean13', 'ean8', 'upc_a', 'upc_e'],
              }}
            />
            <View style={styles.overlay}>
              <View style={styles.scanTarget} />
              <Text style={styles.instruction}>Apunta el código de barras dentro del recuadro</Text>
              <Pressable style={styles.cancelBtn} onPress={onClose}>
                <Text style={styles.cancelText}>Cancelar Escaneo</Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  text: {
    color: '#ffffff',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  btn: {
    backgroundColor: '#1d493d',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  btnText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  closeBtn: {
    marginTop: 16,
  },
  closeText: {
    color: '#94a3b8',
  },
  cameraContainer: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  scanTarget: {
    width: 260,
    height: 180,
    borderWidth: 2,
    borderColor: '#22c55e',
    borderRadius: 12,
    backgroundColor: 'transparent',
  },
  instruction: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 20,
  },
  cancelBtn: {
    marginTop: 30,
    backgroundColor: '#334155',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  cancelText: {
    color: '#ffffff',
    fontWeight: '600',
  },
});
