package project.spms.spms.dto;

import lombok.Data;
import project.spms.spms.entity.*;
import java.util.List;

@Data
public class ProjectDetailDto {
    private Integer id;
    private String code;
    private String name;
    private String description;
    private String departmentName;
    private String status;
    private String priority;
    private String urgency;
    private Integer progress;
    private String progressNote;
    private String startDate;
    private String deadline;
    private List<TeamMemberDto> team;
    private List<ProjectFile> files;
    private List<ProjectComment> comments;
    private List<ProjectHistory> history;

    @Data
    public static class TeamMemberDto {
        private Integer userId;
        private String name;
        private String avatarInitials;
        private String roleInProject;
        private Integer commits;
        private Integer hoursContributed;
    }
}