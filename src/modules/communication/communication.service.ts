import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_CLIENT } from "../supabase/supabase.module";
import { BodyCreateEvent, BodyOpeningCalls, ParamOpeningCalls } from "./types/dto/communication.dto";
import { differenceInMinutes, format, isBefore } from 'date-fns';
import camelcaseKeys from "camelcase-keys";
import { flattenObject } from "../../utils/flatten-object"
import { v4 } from "uuid";
import { normalizeFileName } from "src/utils/normalize-file-name";
import { getFullMonthInterval } from "src/utils/get-full-month-interval";
import { AuthService } from "../auth/auth.service";
import { Cron, CronExpression } from "@nestjs/schedule";
import { ptBR } from "date-fns/locale";
import { MailerService } from "@nestjs-modules/mailer";
import { generateCode } from "src/utils/generate-code";

@Injectable()
export class CommunicationService {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    private readonly authService: AuthService,
    private readonly mailerService: MailerService
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
      .lte('date', endDate)
      .order('date', { ascending: false })


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
      .eq('id', apartment);

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
        picked_up_at: data.deliveredDate,
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
      .eq('id', apartment);

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
      .select(`*,
        polls_options (*)
        `)
      .eq('condominium_id', filters.condominiumId)
      .gte('start_date', `${startDate}T00:00:00.000Z`)
      .lt('start_date', `${endDate}T23:59:59.999Z`);

    const { data: apartaments, error: errorApartaments } = await this.supabase
      .from('apartment')
      .select('id')
      .eq('condominium_id', filters.condominiumId);

    if (errorApartaments) {
      throw new Error(errorApartaments.message)
    }

    if (pollsError) {
      throw new Error(pollsError.message)
    }

    const pollsWithVote = await Promise.all(polls?.map(async poll => {
      const { data: votes, error: votesError } = await this.supabase
        .rpc("get_poll_votes", { p_poll_id: poll.id });

      if (votesError) {
        console.log(votesError.message)
        return null
      }

      const votesFormatted = camelcaseKeys(votes.map(vote => flattenObject(vote))) as any


      const apartamentsIds = votesFormatted
        .filter(vote => vote?.userAssociationApartmentId)
        .map(vote => vote.userAssociationApartmentId)


      const uniquesApartamentsIds = new Set(apartamentsIds);

      let votesInfo: any = [];
      votesFormatted.forEach((vote: any) => {
        const hasVoteInfo = votesInfo.find(voteInfo => voteInfo.optionId === vote.optionId);


        if (!hasVoteInfo) {
          votesInfo = [
            ...votesInfo,
            {
              optionId: vote.optionId,
              optionName: vote.pollsOptionsName,
              total: 1
            }
          ]
        } else {
          const indexCurrentVote = votesFormatted.findIndex(vote => vote.optionId === hasVoteInfo.optionId)
          votesInfo[indexCurrentVote] = {
            ...hasVoteInfo,
            total: hasVoteInfo.total + 1
          }
        }
      })
      const totalVotes = votes.length;
      const currentUserAlreadyVoted = votes.some(vote => vote.polls_user_relation.user_id === userId);
      const currentVoteUser = votesFormatted.find(vote => vote.userId === userId) ? votesFormatted.find(vote => vote.userId === userId).pollsOptionsId : null;
      const currentVoteUserId = votesFormatted.find(vote => vote.userId === userId) ? votesFormatted.find(vote => vote.userId === userId).pollsUserRelationId : null;
      const percentageParticipation = ((uniquesApartamentsIds.size / apartaments.length) * 100).toFixed(2)
      return {
        ...poll,
        totalVotes,
        currentUserAlreadyVoted,
        currentVoteUser,
        votesInfo,
        percentageParticipation,
        currentVoteUserId,
      }
    }));
    const reducePercetageParticipation = pollsWithVote.reduce((acc, vote: any) => {
      return acc += Number(vote.percentageParticipation)
    }, 0)


    const accuracyPercentageParticipation = (reducePercetageParticipation / polls.length);

    return camelcaseKeys({
      accuracyPercentageParticipation,
      data: pollsWithVote
    }, { deep: true })
  }


  async getOptionsVoteByPoll(pollId: string) {
    const { data } = await this.supabase.from("polls_options")
      .select(`*`)
      .eq('poll_id', pollId);
    return data;
  }


  async createVoteAssemblyVirtualPoll(
    pollId: string,
    data: { choice: string },
    token: string) {
    const { data: polls } = await this.supabase.from("polls").select("*").eq("id", pollId);
    const currentPoll = polls?.[0];
    const alreadyFinished = isBefore(new Date(currentPoll.end_date), new Date());
    if (alreadyFinished) {
      throw new Error('Enquete encerrada.')
    }
    const { userId } = await this.authService.decodeToken(token);
    const user = await this.authService.me(userId);
    const { error: voteInsertError } = await this.supabase
      .from("polls_user_relation")
      .insert({
        poll_id: pollId,
        user_id: userId,
        condominium_id: user.condominiumId,
        option_id: data.choice
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
    const { data: polls, error } = await this.supabase.from('polls').insert({
      start_date: startDate,
      end_date: data.endDate,
      created_at: startDate,
      title: data.title,
      description: data.description,
      condominium_id: user.condominiumId,
      status: 'Aberto',
    }).select('id')
    if (error) throw new Error(error.message);

    const pollIdInserted = polls?.[0]?.id;

    if (pollIdInserted) {
      await Promise.all(
        data.options.map(async (option) => {
          return this.supabase
            .from('polls_options')
            .insert({
              name: option.name,
              poll_id: pollIdInserted,
            })
        }))
    }
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
    if (error) throw new Error(error.message);

    if (data.optionsToRemove.length > 0) {
      await Promise.all(data.optionsToRemove.map(async (option) => {
        await this.supabase.from("polls_user_relation").delete().eq('option_id', option)
        await this.supabase.from('polls_options').delete().eq('id', option)
      }));
    }

    if (data.options.length > 0) {
      const optionsToUpdate = data.options.filter(option => option.optionId > 0)
      const optionsToAdd = data.options.filter(option => option.optionId < 0)

      await Promise.all(optionsToUpdate.map(async option => {
        await this.supabase.from("polls_options").update({
          name: option.name
        }).eq('id', option.optionId)
      }))

      await Promise.all(optionsToAdd.map(async option => {
        await this.supabase.from('polls_options').insert({
          name: option.name,
          poll_id: pollId,
        })
      }))
    }
  }

  async deleteAssemblyVirtualPoll(pollId: string) {
    await this.supabase.from('polls_user_relation')
      .delete()
      .eq('poll_id', pollId)
    await this.supabase.from("polls")
      .delete()
      .eq('id', pollId);
  }

  async getScheduleCondomnium({
    date,
    condominiumId
  }: { date: string, condominiumId: number }) {
    const { endDate }
      = getFullMonthInterval(date);

    const [year, month, endDay] = endDate.split('-');

    const { data: events, error, } = await this.supabase
      .from("event")
      .select("*")
      .eq("condominium_id", condominiumId)

    let result: {
      dayNumber: number
      dayName: string,
      events: any[] | undefined
    }[] = [];

    const eventsCamelkeys = camelcaseKeys(events ?? [], { deep: true })

    for (let i = 0; i < Number(endDay); i++) {
      const dateFormattedToDay = `${year}-${month}-${(i + 1).toString().padStart(2, '0')}`
      const eventsFiltered = eventsCamelkeys?.filter(event => event.startTime.includes(dateFormattedToDay));
      const dayName = format(`${dateFormattedToDay}T00:00:00`, "EEEE", { locale: ptBR });

      const eventDay = {
        date: dateFormattedToDay,
        dayNumber: i + 1,
        dayName,
        events: eventsFiltered
      }
      result.push(eventDay)
    }

    return result;
  }

  async createEventCondominium(token: string, data: BodyCreateEvent) {
    const { userId } = await this.authService.decodeToken(token);
    const {
      condominiumId
    } = await this.authService.me(userId);

    const startTimeFormatted = `${data.date} ${data.startTime}`
    const endTimeFormatted = `${data.date} ${data.endTime}`

    const { data: events, error } = await this.supabase.from('event').insert({
      title: data.title,
      description: data.description,
      start_time: startTimeFormatted,
      end_time: endTimeFormatted,
      condominium_id: condominiumId,
      type: data.type,
      created_at: new Date(),
      created_by: userId,
      area: data.location
    }).select('*');

    if (error) {
      throw new Error(error.message)
    }

    return camelcaseKeys(events[0])
  }

  async updateEventCondominium(eventId: string, data: BodyCreateEvent) {
    const startTimeFormatted = `${data.date} ${data.startTime}`
    const endTimeFormatted = `${data.date} ${data.endTime}`

    const { error } = await this.supabase
      .from('event')
      .update({
        title: data.title,
        description: data.description,
        start_time: startTimeFormatted,
        end_time: endTimeFormatted,
        area: data.location,
        updated_at: new Date(),
        type: data.type,
      })
      .eq('id', eventId);

    if (error) {
      throw new Error(error.message);
    }

  }

  async deleteEventCondominium(eventId: string) {
    await this.supabase.from('event').delete().eq('id', eventId)
  }

  @Cron(CronExpression.EVERY_10_HOURS)
  async finishPoll() {
    const currentDate = new Date().toISOString();
    const { data: pollsToFinished, error } = await this.supabase
      .from('polls')
      .select("*")
      .neq('status', 'Encerrado')
      .lt('end_date', currentDate);

    if (error) throw new Error(error.message);

    await Promise.all(pollsToFinished?.map(async (poll) => {
      const { error: updateError } = await this.supabase
        .from('polls')
        .update({
          status: 'Encerrado'
        })
        .eq('id', poll.id);

      if (updateError) throw new Error(updateError.message);
    }));
  }

  async sendCodeToMarkAsDelivery(deliveryId: string) {

    // Busca a entrega
    const { data, error } = await this.supabase.from('delivery')
      .select('*')
      .eq('id', deliveryId);

    if (error) throw new Error(error.message);

    const currentDelivery = camelcaseKeys(data?.[0]);

    // Busca o apartamento
    const { data: apartments, error: apartmentsError } = await this.supabase.from('apartment')
      .select("*")
      .eq('id', currentDelivery.apartmentId);

    if (apartmentsError) throw new Error(apartmentsError.message);

    const mainEmail = apartments?.[0]?.email;

    if (!mainEmail) {
      throw new Error('Não há e-mail vinculado a este apartamento. Por favor, entre em contato com o síndico.');
    }

    // Insere o código de confirmação
    const { data: codeInserteds, error: insertCodeError } = await this.supabase.from('confirmation_codes').insert({
      code: generateCode(),
      register_id: deliveryId,
      table_reference: 'delivery',
      created_at: new Date(),
      expires_at: new Date(Date.now() + 15 * 60 * 1000),
      used: false
    }).select('*');

    if (insertCodeError) throw new Error(insertCodeError.message);

    const code = codeInserteds?.[0]?.code;

    await this.mailerService.sendMail({
      to: mainEmail,
      subject: 'Confirmação de Entrega - CondoControl',
      html: `
      <div style="font-family: Arial, sans-serif; line-height:1.5; color:#333;">
        <h2 style="color:#4CAF50;">Confirmação de Entrega</h2>
        <p>Olá,</p>
        <p>Você recebeu um novo código para marcar a entrega do seu pedido:</p>
        <div style="margin: 20px 0; padding: 15px; background-color:#f4f4f4; border-radius:8px; text-align:center; font-size:24px; font-weight:bold; letter-spacing:2px;">
          ${code}
        </div>
        <p>Este código é válido por <strong>15 minutos</strong>.</p>
        <p>Por favor, use este código para confirmar a entrega.</p>
        <p>Obrigado,<br/><strong>CondoControl</strong></p>
      </div>
    `,
    });

  }

  async confirmationDelivery(code: string) {
    const { data: codes, error: codesError } = await this.supabase
      .from('confirmation_codes')
      .select('*')
      .eq('code', code);

    if (codesError) throw new Error(codesError.message);

    const currentCode = codes?.[0];

    if (!currentCode) {
      throw new Error('Código não encontrado.');
    }

    if (new Date(currentCode.expires_at) < new Date()) {
      throw new Error('O código expirou. Por favor, solicite um novo código.');
    }

    const { data, error } = await this.supabase
      .from('confirmation_codes')
      .select('*')
      .eq('register_id', currentCode.register_id)
      .eq('table_reference', currentCode.table_reference)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);

    const latestCode = data?.[0];


    const isSameCode = latestCode.code === currentCode.code;

    if (!isSameCode) {
      throw new Error('O código é inválido, utilize o código mais recente.');
    }


    const { error: updateDeliveryError } = await this.supabase
      .from('delivery')
      .update({
        picked_up_at: new Date(),
        status: 2,
      })
      .eq('id', currentCode.register_id);

    if (updateDeliveryError) throw new Error('Erro ao atualizar o delivery.');


    await this.supabase
      .from('confirmation_codes')
      .update({ used: true })
      .eq('id', currentCode.id);
  }

  async updateVoteAssemblyVirtualPoll({ voteId, choice }: { voteId: string, choice: string }) {
    await this.supabase
      .from('polls_user_relation')
      .update({
        option_id: choice,
      })
      .eq('id', voteId)
  }

  /*   async getCardsVirtualAssemblyPolls(filters: {
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
        .select(`*,
          polls_options (*)
          `)
        .eq('condominium_id', filters.condominiumId)
        .gte('start_date', `${startDate}T00:00:00.000Z`)
        .lt('start_date', `${endDate}T23:59:59.999Z`);
  
    }
   */

}
