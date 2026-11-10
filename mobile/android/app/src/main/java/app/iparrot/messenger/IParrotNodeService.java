package app.iparrot.messenger;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;

import androidx.core.app.NotificationCompat;

/**
 * Mantém o nó P2P do IParrot no ar enquanto o app está em segundo plano.
 *
 * O Android encerra processos em segundo plano sem aviso; sem este serviço, o
 * nó cairia e nada chegaria. O serviço não faz trabalho próprio: ele existe
 * para segurar o processo em que o núcleo Go já está rodando.
 */
public class IParrotNodeService extends Service {
    public static final String ACTION_START = "app.iparrot.messenger.START_NODE";
    public static final String ACTION_STOP = "app.iparrot.messenger.STOP_NODE";

    private static final String CHANNEL_ID = "app.iparrot.node";
    private static final int NOTIFICATION_ID = 1;

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_STOP.equals(intent.getAction())) {
            stopForeground(true);
            stopSelf();
            return START_NOT_STICKY;
        }

        createChannel(this);
        startForeground(NOTIFICATION_ID, buildNotification());
        // START_STICKY: se o sistema matar o processo por falta de memória, o
        // serviço volta — mas o núcleo só reinicia quando o app é aberto, então
        // a notificação sumiria sozinha nesse caso.
        return START_STICKY;
    }

    private Notification buildNotification() {
        Intent open = new Intent(this, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent openPending = PendingIntent.getActivity(
                this, 0, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);

        Intent stop = new Intent(this, IParrotNodeService.class).setAction(ACTION_STOP);
        PendingIntent stopPending = PendingIntent.getService(
                this, 1, stop, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);

        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle(getString(R.string.node_service_title))
                .setContentText(getString(R.string.node_service_text))
                .setSmallIcon(R.drawable.ic_stat_iparrot)
                .setColor(0xFF2D3691)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setCategory(NotificationCompat.CATEGORY_SERVICE)
                .setOngoing(true)
                .setShowWhen(false)
                .setContentIntent(openPending)
                .addAction(0, getString(R.string.node_service_stop), stopPending)
                .build();
    }

    /** Canal silencioso: o aviso de "estou conectado" não deve apitar. */
    static void createChannel(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return;
        }
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (manager == null || manager.getNotificationChannel(CHANNEL_ID) != null) {
            return;
        }
        NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                context.getString(R.string.node_channel_name),
                NotificationManager.IMPORTANCE_LOW);
        channel.setDescription(context.getString(R.string.node_channel_description));
        channel.setShowBadge(false);
        channel.enableVibration(false);
        channel.setSound(null, null);
        manager.createNotificationChannel(channel);
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null; // o serviço não é vinculável: o plugin fala com ele por Intent
    }
}
