import { type Collection, ObjectId } from "mongodb";
import type { Proyecto, ProyectoModel, Usuario, UsuarioModel } from "./tps.ts";
import { TareaModel } from "./tps.ts";
import { Tarea } from "./tps.ts";

export const fromModelToUser = (model: UsuarioModel): Usuario => ({
  id: model._id!.toString(),
  name: model.name,
  email: model.email,
  created_at: model.created_at,
});

export const fromModelToProject = async (
  model: ProyectoModel,
  usersCollection: Collection<UsuarioModel>,
): Promise<Proyecto> => {
  const user = await usersCollection.findOne({
    _id: new ObjectId(model.user_id),
  });
  return {
    id: model._id!.toString(),
    name: model.name,
    description: model.description,
    start_date: model.start_date,
    end_date: model.end_date,
    user_id: fromModelToUser(user!),
  };
};

export const fromModelToTask = async (
  model: TareaModel,
  projectsCollection: Collection<ProyectoModel>,
  usersCollection: Collection<UsuarioModel>,
): Promise<Tarea> => {
  const project = await projectsCollection.findOne({
    _id: new ObjectId(model.project_id),
  });
  const projectData = await fromModelToProject(project!, usersCollection);
  return {
    id: model._id!.toString(),
    title: model.title,
    description: model.description,
    status: model.status,
    created_at: model.created_at,
    due_date: model.due_date,
    project_id: projectData,
  };
};
