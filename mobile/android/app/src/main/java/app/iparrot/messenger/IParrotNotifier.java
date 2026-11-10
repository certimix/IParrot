package app.iparrot.messenger;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

/** Avisa o usuário de mensagens novas quando o IParrot está em segundo plano. */
final class IParrotNotifier {
    private static final String CHANNEL_ID = "app.iparrot.messages";
    // Uma notificação por conversa: a chave da conversa vira o id.
    private static final int BASE_ID = 100;

    private IParrotNotifier() {
    }

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
                context.getString(R.string.message_channel_name),
                NotificationManager.IMPORTANCE_HIGH);
        channel.setDescription(context.getString(R.string.message_channel_description));
        channel.enableVibration(true);
        manager.createNotificationChannel(channel);
    }

    static void show(Context context, String title, String body, String conversation) {
        createChannel(context);

        Intent open = new Intent(context, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        if (conversation != null && !conversation.isEmpty()) {
            open.putExtra("conversation", conversation);
        }
        PendingIntent pending = PendingIntent.getActivity(
                context, conversation == null ? 0 : conversation.hashCode(), open,
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                .setSmallIcon(R.drawable.ic_stat_iparrot)
                .setColor(0xFF2D3691)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setCategory(NotificationCompat.CATEGORY_MESSAGE)
                .setAutoCancel(true)
                .setContentIntent(pending);

        int id = conversation == null || conversation.isEmpty()
                ? BASE_ID
                : BASE_ID + Math.abs(conversation.hashCode() % 10000);
        try {
            NotificationManagerCompat.from(context).notify(id, builder.build());
        } catch (SecurityException ignored) {
            // Android 13+: o usuário não deu a permissão de notificação.
        }
    }
}
