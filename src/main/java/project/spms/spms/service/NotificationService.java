package project.spms.spms.service;

import project.spms.spms.entity.Notification;
import project.spms.spms.repository.NotificationRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class NotificationService {

    @Autowired
    private NotificationRepository notifRepo;

    @Transactional
    public Notification send(Integer userId, String title, String message,
            Notification.NotifType type, String link) {
        Notification n = new Notification();
        n.setUserId(userId);
        n.setTitle(title);
        n.setMessage(message);
        n.setType(type);
        n.setLink(link != null ? link : "overview");
        return notifRepo.save(n);
    }

    /** Convenience overload for info type. */
    @Transactional
    public Notification sendInfo(Integer userId, String title, String message, String link) {
        return send(userId, title, message, Notification.NotifType.info, link);
    }

    /** Convenience overload for warning type. */
    @Transactional
    public Notification sendWarning(Integer userId, String title, String message, String link) {
        return send(userId, title, message, Notification.NotifType.warning, link);
    }
}