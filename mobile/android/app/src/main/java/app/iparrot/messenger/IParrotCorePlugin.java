package app.iparrot.messenger;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.File;
import java.security.KeyStore;
import java.security.SecureRandom;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

import iparrotcore.Iparrotcore;

/**
 * Sobe o núcleo P2P do IParrot (Go, via gomobile) e entrega à interface o
 * endereço local e o token da API.
 *
 * A chave que criptografa os bancos é aleatória, fica cifrada por uma chave do
 * Android Keystore e nunca é gravada em claro.
 */
@CapacitorPlugin(
        name = "IParrotCore",
        permissions = {
                @Permission(alias = "notifications", strings = {Manifest.permission.POST_NOTIFICATIONS})
        })
public class IParrotCorePlugin extends Plugin {
    private static final String PREFS = "iparrot_core";
    private static final String PREF_KEY = "storage_key";
    private static final String PREF_IV = "storage_key_iv";
    private static final String KEYSTORE_ALIAS = "iparrot_storage_wrap";

    @PluginMethod
    public void start(PluginCall call) {
        // O primeiro início cria identidade e bancos: fora da thread principal.
        new Thread(() -> {
            try {
                File dir = new File(getContext().getFilesDir(), "iparrot");
                String info = Iparrotcore.startWithKey(dir.getAbsolutePath(), storageKeyHex(getContext()));
                call.resolve(new JSObject(info));
            } catch (Exception e) {
                call.reject("Não foi possível iniciar o núcleo do IParrot: " + e.getMessage(), e);
            }
        }, "iparrot-core-start").start();
    }

    /**
     * Liga o serviço em primeiro plano, que segura o processo com o app em
     * segundo plano. Sem ele, o Android derruba o nó e nada chega.
     */
    @PluginMethod
    public void startBackgroundService(PluginCall call) {
        Context context = getContext();
        Intent intent = new Intent(context, IParrotNodeService.class).setAction(IParrotNodeService.ACTION_START);
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent);
            } else {
                context.startService(intent);
            }
            call.resolve();
        } catch (Exception e) {
            call.reject("Não foi possível manter o IParrot ativo em segundo plano: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void stopBackgroundService(PluginCall call) {
        Context context = getContext();
        context.stopService(new Intent(context, IParrotNodeService.class));
        call.resolve();
    }

    /** Mostra um aviso de mensagem nova. A interface decide quando chamar. */
    @PluginMethod
    public void notifyMessage(PluginCall call) {
        String title = call.getString("title", "");
        String body = call.getString("body", "");
        if (title.isEmpty() && body.isEmpty()) {
            call.reject("notificação sem conteúdo");
            return;
        }
        IParrotNotifier.show(getContext(), title, body, call.getString("conversation", ""));
        call.resolve();
    }

    /** Pede a permissão de notificação (Android 13+). Antes disso é automática. */
    @PluginMethod
    public void ensureNotificationPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU
                || getContext().checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED) {
            JSObject result = new JSObject();
            result.put("granted", true);
            call.resolve(result);
            return;
        }
        requestPermissionForAlias("notifications", call, "notificationPermissionResult");
    }

    @PermissionCallback
    private void notificationPermissionResult(PluginCall call) {
        JSObject result = new JSObject();
        result.put("granted", "granted".equals(getPermissionState("notifications").toString()));
        call.resolve(result);
    }

    @Override
    protected void handleOnDestroy() {
        try {
            getContext().stopService(new Intent(getContext(), IParrotNodeService.class));
            Iparrotcore.stop();
        } catch (Exception ignored) {
            // o processo está encerrando
        }
        super.handleOnDestroy();
    }

    /** Lê (ou cria) a chave de 32 bytes, protegida pelo Android Keystore. */
    private static String storageKeyHex(Context context) throws Exception {
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        SecretKey wrap = wrappingKey();

        String stored = prefs.getString(PREF_KEY, null);
        String iv = prefs.getString(PREF_IV, null);
        if (stored != null && iv != null) {
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, wrap, new GCMParameterSpec(128, Base64.decode(iv, Base64.NO_WRAP)));
            return toHex(cipher.doFinal(Base64.decode(stored, Base64.NO_WRAP)));
        }

        byte[] key = new byte[32];
        new SecureRandom().nextBytes(key);

        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, wrap);
        byte[] sealed = cipher.doFinal(key);

        boolean saved = prefs.edit()
                .putString(PREF_KEY, Base64.encodeToString(sealed, Base64.NO_WRAP))
                .putString(PREF_IV, Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP))
                .commit();
        if (!saved) {
            throw new IllegalStateException("não foi possível guardar a chave de armazenamento");
        }
        return toHex(key);
    }

    private static SecretKey wrappingKey() throws Exception {
        KeyStore keyStore = KeyStore.getInstance("AndroidKeyStore");
        keyStore.load(null);
        if (keyStore.containsAlias(KEYSTORE_ALIAS)) {
            return (SecretKey) keyStore.getKey(KEYSTORE_ALIAS, null);
        }
        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        generator.init(new KeyGenParameterSpec.Builder(KEYSTORE_ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .build());
        return generator.generateKey();
    }

    private static String toHex(byte[] bytes) {
        StringBuilder sb = new StringBuilder(bytes.length * 2);
        for (byte b : bytes) {
            sb.append(String.format("%02x", b));
        }
        return sb.toString();
    }
}
