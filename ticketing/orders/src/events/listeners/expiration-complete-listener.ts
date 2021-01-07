import {
    Listener,
    ExpirationCompleteEvent,
    Subjects,
    OrderStatus,
} from '@epitickets/common';
import { queueGroupName } from './queue-group-name';
import { Message } from 'node-nats-streaming';
import { Order } from '../../models/order';
import { OrderCancelledPublisher } from '../publishers/order-cancelled-publisher';

export class ExpirationCompleteListener extends Listener<ExpirationCompleteEvent> {
    subject: Subjects.ExpirationComplete = Subjects.ExpirationComplete;
    queueGroupName = queueGroupName;
    async onMessage(data: ExpirationCompleteEvent['data'], msg: Message) {
        const order = await Order.findById(data.orderId).populate('ticket');

        if(!order) {
            throw new Error('Order not found');
        }

        if (order.status === OrderStatus.Complete) {
            msg.ack();
        }

        const ticketId = order.ticket.id;

        order.set({
            status: OrderStatus.Cancelled,
            ticket: null
        });
        await order.save();

        await new OrderCancelledPublisher(this.client).publish({
            id: order.id!,
            version: order.version,
            ticket: {
                id: ticketId!
            }
        });
        msg.ack();
    }
}
