import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_CLIENT } from "../supabase/supabase.module";
import { BodyOpeningCalls, ParamOpeningCalls } from "./types/dto/communication.dto";
import { differenceInMinutes } from 'date-fns';
import camelcaseKeys from "camelcase-keys";
import { flattenObject } from "../../utils/flatten-object"
import { v4 } from "uuid";
import { normalizeFileName } from "src/utils/normalize-file-name";
import { getFullMonthInterval } from "src/utils/get-full-month-interval";
import { AuthService } from "../auth/auth.service";
import { Cron, CronExpression } from "@nestjs/schedule";

@Injectable()
export class CommunicationService {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    private readonly authService: AuthService
  ) { }

  async getOptionsStatusOpeningCalls() {
    const { data, error } = await this.supabase.from('call_statuses').select("*");
    if (error) {
      throw new Error(error.message)
    }
    return data;
  }

  async getOptionsIssuesOpeningCalls() {
    const { data, error } = await this.supabase.from('issue_types').select("*");
    if (error) {
      throw new Error(error.message)
    }
    return data;
  }

  async getCardsOpeningOfCalls(data: ParamOpeningCalls) {

    const { condominiumId, startDate, endDate } = data;

    const { data: callRecords, error } = await this.supabase
      .from('calls')
      .select(`
      *,
      user (id, name),
      call_statuses (id, name),
      issue_types (id, name)
      `)
      .eq('condominium_id', condominiumId)
      .gte('date', startDate)
      .lte('date', endDate);

    if (error) {
      throw new Error(error.message)
    }

    let totalCallIsGoing = 0
    let totalCallsSolved = 0
    let totalHoursCallSolved = 0
    let accuracyHoursCallSolved = 0
    let totalCallsMonth = 0

    callRecords.forEach(callRecord => {
      totalCallsMonth += 1;

      if (callRecord.status_id === 2) {
        totalCallIsGoing += 1
      }

      if (callRecord.status_id === 3) {
        totalCallsSolved += 1;
        if (callRecord.started_at && callRecord.resolved_at) {
          const diffInMinutes = differenceInMinutes(callRecord.resolved_at, callRecord.started_at);
          const diffInHours = diffInMinutes / 60
          totalHoursCallSolved += diffInHours;
        }
      }
    })
    accuracyHoursCallSolved = (totalHoursCallSolved / totalCallsSolved) > 0 ? (totalHoursCallSolved / totalCallsSolved) : 0;

    return {
      totalCallIsGoing,
      totalCallsSolved,
      accuracyHoursCallSolved,
      totalCallsMonth
    }
  }

  async getRecordsOpeningOfCalls(data: ParamOpeningCalls) {
    const { condominiumId, startDate, endDate } = data;

    const { data: callRecords, error } = await this.supabase
      .from('calls')
      .select(`
      *,
      user (id, name),
      call_statuses (id, name),
      issue_types (id, name)
      `)
      .eq('condominium_id', condominiumId)
      .gte('date', startDate)
      .lte('date', endDate);


    if (error) {
      throw new Error(error.message)
    }

    const callIds = callRecords.map(call => call.id);

    const { data: attachments, error: errorAttachments } = await this.supabase
      .from('attachments')
      .select('*')
      .in('related_id', callIds)
      .eq('related_type', 'calls');

    if (errorAttachments) {
      throw new Error(errorAttachments.message)
    }

    const flattenCallRecords = callRecords.map(callRecord => flattenObject(callRecord));
    const camelkeysAttachments = camelcaseKeys(attachments)

    const callsWithAttachments = flattenCallRecords.map((call: any) => {
      return {
        ...call,
        attachments: camelkeysAttachments?.filter((att: any) => att.relatedId === call.id),
      };
    });

    return camelcaseKeys(callsWithAttachments);
  }

  async getEmployees() {
    const { data, error } = await this.supabase.from('user_association').select(`*, user (id,name)`).eq('role', 'employee')

    if (error) {
      throw new Error(error.message)
    }

    return camelcaseKeys(data.map(employee => flattenObject(employee)))
  }

  async createOpeningCallRecord(condominiumId: string, {
    date,
    description,
    issueTypeId,
    responsibleId,
    statusId,
    resolvedDate,
    startedDate
  }: BodyOpeningCalls, attachment: any) {

    const { data: callRecord, error } = await this.supabase.from('calls').insert({
      date,
      issue_type_id: issueTypeId,
      description,
      responsible_user_id: responsibleId,
      started_at: startedDate,
      resolved_at: resolvedDate,
      status_id: statusId,
      condominium_id: condominiumId
    }).select()

    if (error) {
      throw new Error(error.message)
    }

    const recordId = callRecord?.[0]?.id

    if (Array.isArray(attachment) && attachment.length > 0) {

      attachment.map(async attachment => {

        const fileName = normalizeFileName(attachment.originalname)

        const uniqueFileName = `${v4()}-${fileName}`;

        const { data: fileData, error } = await this.supabase.storage.from('condo').upload(`uploads/${uniqueFileName}`, attachment.buffer);

        if (error) {
          throw new Error(error.message)
        }

        const { data, error: attachmentInserError } = await this.supabase.from("attachments").insert({
          related_type: 'calls',
          related_id: recordId,
          condominium_id: condominiumId,
          date,
          bucket_name: 'condo',
          original_name: fileName,
          screen_origin: 'calls',
          path: fileData.fullPath,
          supabase_id: fileData.id
        })

        if (attachmentInserError) {
          throw new Error(attachmentInserError.message)
        }

      })

    }
  }

  async openingCallsAttachmentDownload(fullPath: string) {

    const bucketName = 'condo';

    const relativePath = fullPath.startsWith(`${bucketName}/`)
      ? fullPath.slice(bucketName.length + 1)
      : fullPath;

    const { data } = await this.supabase.storage
      .from(bucketName)
      .getPublicUrl(relativePath)

    return data;
  }

  async createAttachmentOpeningCalls(openingRecordId: number, condominiumId: number, attachment: any) {

    if (Array.isArray(attachment) && attachment.length > 0) {

      const result = attachment.map(async attachment => {

        const fileName = normalizeFileName(attachment.originalname)

        const uniqueFileName = `${v4()}-${fileName}`;

        const { data: fileData, error } = await this.supabase.storage.from('condo').upload(`uploads/${uniqueFileName}`, attachment.buffer);

        if (error) {
          throw new Error(error.message)
        }

        const { data: attachments, error: attachmentInserError } = await this.supabase.from("attachments").insert({
          related_type: 'calls',
          related_id: openingRecordId,
          condominium_id: condominiumId,
          date: new Date(),
          bucket_name: 'condo',
          original_name: fileName,
          screen_origin: 'calls',
          path: fileData.fullPath,
          supabase_id: fileData.id
        }).select()

        if (attachmentInserError) {
          throw new Error(attachmentInserError.message)
        }


        return camelcaseKeys(attachments?.[0])
      })

      return Promise.all(result)

    }
  }

  async deleteAttachmentOpeningCall(attachmentId: string) {

    const { data: attachments, error } = await this.supabase.from('attachments').select("*").eq('id', attachmentId);

    if (error) {
      throw new Error(error.message)
    }

    const { data: dataDelete, error: errorDelete } = await this.supabase.from('attachments').delete().eq('id', attachmentId);

    if (errorDelete) {
      throw new Error(errorDelete.message)
    }

    const bucketName = "condo";

    const pathRecord = attachments?.[0]?.path

    const relativePath = pathRecord.startsWith(`${bucketName}/`)
      ? pathRecord.slice(bucketName.length + 1)
      : pathRecord;

    const { data, error: errorDeleteAttachment } = await this.supabase.storage.from('condo').remove([relativePath])

    if (errorDeleteAttachment) {
      throw new Error(errorDeleteAttachment.message)
    }

  }


  async deleteOpeningCallsRecord(recordId: string) {

    const { data: _, error } = await this.supabase.from("calls")
      .delete()
      .eq('id', recordId);

    if (error) {
      throw new Error(error.message)
    }

    const { data: attachments, error: attachmentsError } = await this.supabase.from("attachments")
      .select("*")
      .eq('related_type', 'calls')
      .eq("related_id", recordId)

    if (attachmentsError) {
      throw new Error(attachmentsError.message)
    }

    const attachmentsToDelete = attachments.map(async attachment => {
      const { data: _, error: errorDelete } =
        await this.supabase.from('attachments')
          .delete()
          .eq('id', attachment.id);

      if (errorDelete) {
        throw new Error(errorDelete.message)
      }

      const bucketName = "condo";

      const pathRecord = attachment.path

      const relativePath = pathRecord.startsWith(`${bucketName}/`)
        ? pathRecord.slice(bucketName.length + 1)
        : pathRecord;

      await this.supabase.storage.from('condo').remove([relativePath])
    })

    await Promise.all(attachmentsToDelete)

  }

  async updateOpeningCallRecord(recordId: string, data: Omit<BodyOpeningCalls, 'date'>) {

    const {
      description,
      issueTypeId,
      responsibleId,
      statusId,
      resolvedDate,
      startedDate
    } = data;

    const { data: _, error } = await this.supabase.from('calls').update({
      description,
      responsible_user_id: responsibleId,
      issue_type_id: issueTypeId,
      started_at: startedDate,
      resolved_at: resolvedDate,
      status_id: statusId
    })
      .eq('id', recordId);

    if (error) {
      throw new Error(error.message)
    }
  }

  async getDeliveryStatusOptions() {
    const { data, error } = await this.supabase.from("delivery_status")
      .select("*");

    if (error) {
      throw new Error(error.message)
    }

    return camelcaseKeys(data)
  }

  async getApartamentsByCondominiumId(condominiumId: string) {
    const {
      data, error
    } = await this.supabase.from('apartment').select("*").eq('condominium_id', condominiumId);

    if (error) {
      throw new Error(error.message)
    }

    return camelcaseKeys(data)
  }

  async getDeliveriesByCondominiumId(filters: any) {
    const { startDate, endDate } = filters;
    const startDateWithHours = startDate + ' 00:00:00'
    const endDateWithHours = endDate + ' 23:59:59'
    const {
      data: deliveries,
      error } =
      await this.supabase.from("delivery")
        .select(
          `*, 
          apartment (apartment_number),
          delivery_status (name)
          `)
        .eq('condominium_id', filters.condominiumId)
        .gte('received_at', startDateWithHours)
        .lte('received_at', endDateWithHours);

    if (error) {
      throw new Error(error.message)
    }

    const deliveriesIds = deliveries.map(delivery => delivery.id)
    const { data: attachments, error: errorAttachments } = await this.supabase
      .from('attachments')
      .select('*')
      .in('related_id', deliveriesIds)
      .eq('related_type', 'package');

    if (errorAttachments) {
      throw new Error(errorAttachments.message)
    }


    const attachmentsCamelcase = camelcaseKeys(attachments)
    const resultFlatten = deliveries.map(delivery => flattenObject(delivery));
    const deliveriesCamalcase = camelcaseKeys(resultFlatten);

    return deliveriesCamalcase.map((delivery: any) => ({
      ...delivery,
      attachments: attachmentsCamelcase?.filter((att: any) => att.relatedId === delivery.id),
    }))
  }

  async createDelivery(data, attachment) {

    const { condominiumId, apartment } = data;
    const { data: apartaments, error: apartamentsError } = await this.supabase.from('apartment')
      .select("*")
      .eq('condominium_id', condominiumId)
      .eq('apartment_number', apartment);

    if (apartamentsError) {
      throw new Error(apartamentsError.message)
    }

    const apartamentId = apartaments?.[0]?.id;

    if (!apartamentId) {
      throw new BadRequestException('Nenhum apartamento foi encontrado com esse número.')
    }

    const statusDelivery = data.deliveredDate ? 2 : 1;
    const { data: insertData, error } = await this.supabase.from('delivery')
      .insert({
        description: data.description,
        received_at: data.receivedDate,
        picked_at_up: data.deliveredDate,
        condominium_id: data.condominiumId,
        apartment_id: apartamentId,
        status: statusDelivery,
      }).select('*')

    if (error) {
      throw new Error(error.message)
    }

    const insertDataId = insertData?.[0]?.id;

    if (Array.isArray(attachment) && attachment.length > 0) {
      const result = attachment.map(async file => {
        const fileName = normalizeFileName(file.originalname)
        const uniqueFileName = `${v4()}-${fileName}`;
        const { data: fileData, error } = await this.supabase.storage
          .from('condo')
          .upload(`uploads/${uniqueFileName}`, file.buffer);

        if (error) {
          throw new Error(error.message)
        }
        const date = new Date()
        const { data, error: attachmentInserError } = await this.supabase.from("attachments").insert({
          related_type: 'package',
          related_id: insertDataId,
          condominium_id: condominiumId,
          date,
          bucket_name: 'condo',
          original_name: fileName,
          screen_origin: 'package',
          path: fileData.fullPath,
          supabase_id: fileData.id
        })

        if (attachmentInserError) {
          throw new Error(attachmentInserError.message)
        }
      })

      await Promise.all(result);
    }
  }

  async updateDelivery(deliveryId, data, attachment) {

    const { condominiumId, apartment } = data;

    const { data: apartaments, error: apartamentsError } = await this.supabase.from('apartment')
      .select("*")
      .eq('condominium_id', condominiumId)
      .eq('apartment_number', apartment);

    if (apartamentsError) {
      throw new Error(apartamentsError.message)
    }

    const apartamentId = apartaments?.[0]?.id;

    if (!apartamentId) {
      throw new BadRequestException('Nenhum apartamento foi encontrado com esse número.')
    }

    const statusDelivery = data.deliveredDate ? 2 : 1;

    const { data: _, error } = await this.supabase.from('delivery')
      .update({
        description: data.description,
        received_at: data.receivedDate,
        picked_up_at: data.deliveredDate,
        condominium_id: data.condominiumId,
        apartment_id: apartamentId,
        status: statusDelivery,
      })
      .eq("id", deliveryId)

    if (error) {
      throw new Error(error.message)
    }


    if (Array.isArray(attachment) && attachment.length > 0) {
      const result = attachment.map(async file => {
        const fileName = normalizeFileName(file.originalname)
        const uniqueFileName = `${v4()}-${fileName}`;
        const { data: fileData, error } = await this.supabase.storage
          .from('condo')
          .upload(`uploads/${uniqueFileName}`, file.buffer);

        if (error) {
          throw new Error(error.message)
        }
        const date = new Date()
        const { data, error: attachmentInserError } = await this.supabase.from("attachments").insert({
          related_type: 'package',
          related_id: deliveryId,
          condominium_id: condominiumId,
          date,
          bucket_name: 'condo',
          original_name: fileName,
          screen_origin: 'package',
          path: fileData.fullPath,
          supabase_id: fileData.id
        })

        if (attachmentInserError) {
          throw new Error(attachmentInserError.message)
        }
      })

      await Promise.all(result);
    }

  }

  async markAsDelivered(deliveryId: string) {
    const { data, error } = await this.supabase.from('delivery').update({
      status: 2,
      picked_up_at: new Date()
    })
      .eq('id', deliveryId);

    if (error) {
      throw new Error(error.message)
    }
  }

  async deleteDelivery(deliveryId: string) {

    const { error: deleteDeliveryError } = await this.supabase
      .from('delivery')
      .delete()
      .eq('id', deliveryId)

    if (deleteDeliveryError) {
      throw new Error(deleteDeliveryError.message)
    }

    const { data: attachaments, error: attachamentsError } = await this.supabase
      .from('attachments')
      .select("*")
      .eq("related_type", 'package')
      .eq('related_id', deliveryId);

    if (attachamentsError) {
      throw new Error(attachamentsError.message)
    }

    const promissesAttachments = attachaments.map(async (attachament) => {

      const { error: deleteAttachmentError } = await this.supabase
        .from('attachments')
        .delete()
        .eq('id', attachament.id);

      if (deleteAttachmentError) {
        throw new Error(deleteAttachmentError.message)
      }

      const bucketName = "condo";

      const pathRecord = attachament.path

      const relativePath = pathRecord.startsWith(`${bucketName}/`)
        ? pathRecord.slice(bucketName.length + 1)
        : pathRecord;

      await this.supabase.storage.from('condo').remove([relativePath])
    })

    await Promise.all(promissesAttachments)
  }


  async getAssemblyVirtualPolls(filters: {
    date: string,
    condominiumId: string
  }, token: string
  ) {
    const { userId } = await this.authService.decodeToken(token);

    const {
      startDate,
      endDate
    } = getFullMonthInterval(filters.date);
    const { data: polls, error: pollsError } = await this.supabase
      .from('polls')
      .select('*')
      .eq('condominium_id', filters.condominiumId)
      .gte('start_date', `${startDate}T00:00:00.000Z`)
      .lt('start_date', `${endDate}T23:59:59.999Z`);


    if (pollsError) {
      throw new Error(pollsError.message)
    }

    const pollsWithVote = await Promise.all(polls?.map(async poll => {
      const { data: votes, error: votesError } = await this.supabase
        .from("polls_user_relation")
        .select("*")
        .eq('poll_id', poll.id);
      if (votesError) {
        return null
      }
      const totalVotes = votes.length;
      const totalVotesYes = votes.filter(vote => vote.choice.toLowerCase() === 'sim').length;
      const totalVotesNo = votes.filter(vote => vote.choice.toLowerCase() === 'não').length;
      const percentageYes = totalVotes > 0 ? (totalVotesYes / totalVotes) * 100 : 0;
      const percentageNo = totalVotes > 0 ? (totalVotesNo / totalVotes) * 100 : 0;
      const currentUserAlreadyVoted = votes.some(vote => vote.user_id === userId);
      const currentVoteUser = votes.find(vote => vote.user_id === userId) ? votes.find(vote => vote.user_id === userId).choice : null;

      return {
        ...poll,
        totalVotes,
        totalVotesYes,
        totalVotesNo,
        percentageYes,
        percentageNo,
        currentUserAlreadyVoted,
        currentVoteUser
      }
    }));

    return camelcaseKeys(pollsWithVote)
  }

  async createVoteAssemblyVirtualPoll(
    pollId: string,
    body: { choice: string },
    token: string) {
    const { data: polls } = await this.supabase.from("polls").select("*").eq("id", pollId);
    const currentPoll = polls?.[0];
    /*    const alreadyFinished = isBefore(new Date(currentPoll.end_date), new Date());
       if (alreadyFinished) {
         throw new Error('Enquete encerrada.')
       } */
    const { userId } = await this.authService.decodeToken(token);
    const user = await this.authService.me(userId);
    const choiceFormmated = body.choice.toUpperCase();
    const { error: voteInsertError } = await this.supabase
      .from("polls_user_relation")
      .insert({
        poll_id: pollId,
        user_id: userId,
        condominium_id: user.condominiumId,
        choice: choiceFormmated
      })
    if (voteInsertError) throw new Error(voteInsertError.message);
  }

  async createAssemblyVirtualPoll(
    data: any,
    token: string
  ) {
    const startDate = new Date();
    const { userId } = await this.authService.decodeToken(token);
    const user = await this.authService.me(userId)
    const { error } = await this.supabase.from('polls').insert({
      start_date: startDate,
      end_date: data.endDate,
      created_at: startDate,
      title: data.title,
      description: data.description,
      condominium_id: user.condominiumId,
      status: 'Aberto',
    })
    if (error) throw new Error(error.message)
  }

  async updateAssemblyVirtualPoll(
    pollId: string,
    data: any,
    token: string
  ) {
    const { error } = await this.supabase.from('polls').update({
      end_date: data.endDate,
      title: data.title,
      description: data.description,
      updated_at: new Date()
    })
      .eq('id', pollId)
    if (error) throw new Error(error.message)
  }

  async deleteAssemblyVirtualPoll(pollId: string) {
    await this.supabase.from('polls_user_relation')
      .delete()
      .eq('poll_id', pollId)
    await this.supabase.from("polls")
      .delete()
      .eq('id', pollId);
  }

  @Cron(CronExpression.EVERY_10_SECONDS)
  async finishPoll() {
    const currentDate = new Date().toISOString();
    const { data: pollsToFinished, error } = await this.supabase
      .from('polls')
      .select("*")
      .neq('status', 'Encerrado')
      .lt('end_date', currentDate);

    if (error) throw new Error(error.message);

    await Promise.all(pollsToFinished?.map(async (poll) => {
      const { data: votes, error: votesError } = await this.supabase
        .from('polls_user_relation')
        .select('choice')
        .eq('poll_id', poll.id);

      if (votesError) throw new Error(votesError.message);

      // Contagem dos votos
      const counts = votes?.reduce(
        (acc, vote) => {
          const choice = vote.choice.toUpperCase();
          if (choice === 'SIM') acc.sim += 1;
          else if (choice === 'NÃO') acc.nao += 1;
          return acc;
        },
        { sim: 0, nao: 0 }
      ) || { sim: 0, nao: 0 };

      // Definindo resultado final
      let resultFinal = '';
      if (counts.sim > counts.nao) {
        resultFinal = 'SIM';
      } else if (counts.nao > counts.sim) {
        resultFinal = 'NÃO';
      } else {
        resultFinal = 'EMPATE'; // ou '', ou 'Indefinido', como preferir
      }

      // Atualizando enquete com status e resultado final
      const { error: updateError } = await this.supabase
        .from('polls')
        .update({
          status: 'Encerrado',
          final_result: resultFinal,
        })
        .eq('id', poll.id);

      if (updateError) throw new Error(updateError.message);
    }));
  }

}
